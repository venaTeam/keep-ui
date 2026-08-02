import { test, expect } from "../fixtures/test-base";

test.describe("create and activate corrlation rule", () => {
    
    test('create correlation', async ({ correlation, api, page }) => {
        const stamp = Date.now();
        const name = `create-correlation-${stamp}`;
        const incidentNameTemplate = `Correlation incident ${stamp}`;
        const incidentPrefix = "INC";
        const assignee = `corr-${stamp}@example.com`;
        const threshold = 2;
        const timeAmount = 10;

        await correlation.goto();

        await correlation.waitForRulesLoaded();
        const sidebar = await correlation.clickCreate();

        await sidebar.fillName(name);
        await sidebar.fillTimeAmount(timeAmount);
        await sidebar.fillIncidentNameTemplate(incidentNameTemplate);
        await sidebar.fillIncidentPrefix(incidentPrefix);
        await sidebar.fillThreshold(threshold);
        await sidebar.fillAssignee(assignee);

        await sidebar.selectTimeUnit("Hours"); // -> timeframe = 10h = 36000s
        await sidebar.selectResolveOn("All alerts resolved"); // -> resolve_on "all_resolved"
        await sidebar.selectCreateOn("All conditions met"); // -> create_on "all"
        await sidebar.setRequireApprove(true);

        await sidebar.removeGroup(1);
        await sidebar.fillConditionValue("test", 0);

        // Submit and WAIT for the outcome. .click() only DISPATCHES the click — the
        // form's onSubmit fires an async POST /rules and closes the sidebar only after
        // that POST resolves. Without waiting, the test returns right after the click
        // and fixture teardown aborts the in-flight POST, so nothing is created and the
        // sidebar never closes. Arm the response wait BEFORE clicking so we don't miss
        // it, then surface a server rejection's real reason.
        const createResp = page.waitForResponse(
            (r) => r.url().includes("/rules") && r.request().method() === "POST",
            { timeout: 30_000 }
        );
        await sidebar.clickCreateCorrelation();
        const resp = await createResp;
        expect(
            resp.ok(),
            `POST /rules failed: ${resp.status()} ${await resp.text().catch(() => "")}`
        ).toBeTruthy();

        // The app closes the sidebar and returns to /rules on success.
        await expect(sidebar.root).toBeHidden();

        // // --- confirm creation via the API first (proves the rule + name persisted) --
        let rule: any;
        await expect


            .poll(
                async () => {
                    rule = (await api.rules.getRules()).find((r: any) => r.name === name);
                    return Boolean(rule);
                },
                { timeout: 30_000, message: "correlation rule to be created" }
            )
            .toBe(true);

        // // --- validate NAME + CEL through the UI (correlations table) ------------
        // // Fresh-load /rules so the table is guaranteed to reflect the new rule.
        // await correlation.goto();
        const row = correlation.locators.rowByName(name);
        await expect(row).toBeVisible({ timeout: 15_000 });
        await expect(row).toContainText("test"); // the rule's CEL (Description column)

        // // --- validate the rest through the API ---------------------------------
        expect(rule.name).toBe(name);
        expect(rule.definition_cel).toContain("source"); // default condition field
        expect(rule.definition_cel).toContain("test");
        expect(rule.timeframe).toBe(36000);
        expect(rule.timeunit).toBe("hours");
        expect(rule.resolve_on).toBe("all_resolved");
        expect(rule.create_on).toBe("all");
        expect(rule.incident_name_template).toBe(incidentNameTemplate);
        expect(rule.incident_prefix).toBe(incidentPrefix);
        expect(rule.threshold).toBe(threshold);
        expect(rule.require_approve).toBe(true);
        expect(rule.assignee).toBe(assignee);
    })
    

    test('activate correlation rule', async ({ api, incidents }) => {
        const stamp = Date.now();
        const name = `activate-correlation-${stamp}`;

        await api.rules.createRule({ ruleName: name });
        const rule = (await api.rules.getRules()).find((r: any) => r.name === name);
        expect(rule, `correlation rule "${name}" to be created`).toBeTruthy();

        const matchA = await api.alerts.sendAlert({ name: `corr-match-a-${stamp}`, source: ["test"] });
        const matchB = await api.alerts.sendAlert({ name: `corr-match-b-${stamp}`, source: ["test"] });
        const noMatch = await api.alerts.sendAlert({ name: `corr-no-match-${stamp}`, source: ["not-test"] });

        // --- validate the incident shows on the incidents LIST page (UI) --------
        // Correlation is async, so gotoAndExpectRow re-navigates until the row lands.
        // The backend names the incident after the rule (empty incident_name_template
        // => user_generated_name = rule.name), so the rule name is the row's label.
        await incidents.gotoAndExpectRow(name);

        // --- click the incident to enter its page, then validate the alerts (UI) -
        const detail = await incidents.openIncident(name);
        // Re-load the alerts tab until both matching alerts appear — incident/alert
        // association is eventually consistent after ingest.
        await expect(async () => {
            await detail.gotoAlerts();
            await expect(detail.alertsTableBody).toBeVisible({ timeout: 25_000 });
            await expect(detail.alertRow(matchA.fingerprint)).toBeVisible({ timeout: 10_000 });
            await expect(detail.alertRow(matchB.fingerprint)).toBeVisible({ timeout: 10_000 });
        }).toPass({ timeout: 120_000, intervals: [2_000, 5_000] });

        // The non-matching alert must NOT be correlated into this incident.
        await expect(detail.alertRow(noMatch.fingerprint)).toHaveCount(0);
    })
})