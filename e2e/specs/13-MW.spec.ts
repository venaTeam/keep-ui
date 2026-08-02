import { test, expect } from "../fixtures/test-base";

test.describe("[check:13] create and activate MW", () => {
    test('create MW', async ({ mw, api }) => {
        const stamp = Date.now();
        const mwName = `Test MW Creation ${stamp}`;
        const mwDescription = "sanity test - create maintenance window";
        const mwCel = 'status == \"firing\"';

        // Non-default date/time: +2 days at 08:00 local (the default is today at the
        // next rounded quarter-hour). Node and the browser share the system timezone
        // (Playwright sets no timezoneId), so the picked local time round-trips through
        // toISOString the same on both sides.
        const now = new Date();
        const target = new Date(
            now.getFullYear(), now.getMonth(), now.getDate() + 2, 8, 0, 0, 0
        );
        const timeLabel = "8:00 AM"; // matches target's 08:00 in en-US "h:mm a"

        await mw.goto();

        // --- write every field --------------------------------------------------
        await mw.typeName(mwName);
        await mw.typeDescription(mwDescription);
        await mw.typeCel(mwCel);
        // Ignore statuses start as [resolved, acknowledged]; add "firing".
        await mw.selectStatus("Firing");

        // Date + time. Select the DAY first (a future day enables every time slot),
        // then the time. Cross a month boundary if +2 days landed in the next month.
        if (
            target.getMonth() !== now.getMonth() ||
            target.getFullYear() !== now.getFullYear()
        ) {
            await mw.goToNextMonth();
        }
        await mw.selectDate(target.getDate());
        await mw.selectTime(timeLabel);

        await mw.typeDurationNumber(2);
        await mw.chooseDurationUnit("Hours");                    // duration_seconds = 7200
        await mw.chooseDisplayMode("Show in Suppressed Status"); // suppress = true
        await mw.switchEnableRuleToggle();                       // enabled = false (default true)

        await mw.clickCreate();

        // --- validate name + CEL through the UI (rules table) -------------------
        const row = mw.ruleRow(mwName);
        await expect(row).toBeVisible({ timeout: 15_000 });
        await expect(row).toContainText(mwCel);

        // --- validate the rest through the API ---------------------------------
        let created: any;
        await expect
            .poll(
                async () => {
                    const rules = await api.maintenance.getMaintenanceRules();
                    created = rules.find((r: any) => r.name === mwName);
                    return Boolean(created);
                },
                { timeout: 30_000, message: "maintenance rule to persist" }
            )
            .toBe(true);

        expect(created.description).toBe(mwDescription);
        expect(created.cel_query).toBe(mwCel);
        expect(created.duration_seconds).toBe(7200);
        expect(created.suppress).toBe(true);
        expect(created.enabled).toBe(false);
        expect([...created.ignore_statuses].sort()).toEqual([
            "acknowledged", "firing", "resolved",
        ]);

        // start_time is stored UTC-naive (no offset), so append 'Z' before parsing.
        const apiStart = new Date(
            /[zZ]|[+-]\d\d:?\d\d$/.test(created.start_time)
                ? created.start_time
                : created.start_time + "Z"
        );
        expect(apiStart.getTime()).toBe(target.getTime());
    })

    test('activate MW suppresses matching alerts from the feed', async ({ alertsFeed, api }) => {
        const stamp = Date.now();

        // --- create an ACTIVE MW via API: starts now, 1-minute window, matches
        //     source == "test", and HIDES matching alerts from the feed (suppress=false).
        await api.maintenance.createMaintenanceRule({
            name: `activate-mw-${stamp}`,
            cel_query: 'source == "test"',
            start_time: new Date().toISOString(),
            duration_seconds: 60,
            suppress: false,
            enabled: true,
        });

        // --- send firing alerts that MATCH the rule (source "test"), plus one CONTROL
        //     alert that does NOT match — both severity critical so both would pass the
        //     feed filter. ignore_statuses defaults to [resolved, acknowledged], so
        //     firing alerts are caught by the window.
        const matched = await Promise.all(
            [0, 1, 2].map((i) =>
                api.alerts.sendAlert({
                    name: `mw-hidden-${stamp}-${i}`,
                    source: ["test"],
                    severity: "critical",
                    status: "firing",
                })
            )
        );
        const control = await api.alerts.sendAlert({
            name: `mw-control-${stamp}`,
            source: ["control"],
            severity: "critical",
            status: "firing",
        });

        // --- feed set to view every alert it would receive (severity > info). Waiting
        //     for the control row to render proves the pipeline processed + indexed these
        //     events; the matched alerts, dropped at ingestion by the MW, never appear.
        await alertsFeed.loadFeed('severity > "info"', [control.fingerprint]);
        for (const m of matched) {
            await expect(alertsFeed.row(m.fingerprint).root).toHaveCount(0);
        }

        // --- backend: the matched alerts were never ingested (dropped by the MW),
        //     while the control alert exists.
        expect(await api.alerts.getAlert(control.fingerprint)).toBeTruthy();
        for (const m of matched) {
            expect(await api.alerts.getAlert(m.fingerprint)).toBeNull();
        }
    })
})
