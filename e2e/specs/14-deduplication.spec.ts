import { test, expect } from "../fixtures/test-base";

test.describe("create deduplicataion rule and activate it", () => {
    test('create deduplication rule', async ({ deduplication, api, page }) => {
        const stamp = Date.now();
        const name = `dedup-e2e-${stamp}`;
        const description = `dedup e2e rule ${stamp}`;
        const fingerprintFields = ["service", "source"];
        const ignoreFields = ["name"];

        // --- enter the deduplication page and open the create sidebar -----------
        await deduplication.goto();
        await deduplication.waitForRulesLoaded();
        const sidebar = await deduplication.clickCreate();

        // --- complete every field ----------------------------------------------
        await sidebar.fillName(name);
        await sidebar.fillDescription(description);
        // Every alert provider in the noauth stack is a linked provider with no
        // name/id, so they all render with the label "main"; picking "main" selects
        // the first (a valid provider) — the exact provider_type is asserted via API.
        await sidebar.selectProvider("main");
        await sidebar.selectFingerprintFields(fingerprintFields);
        // Full deduplication reveals + requires the Ignore fields select.
        await sidebar.setFullDeduplication(true);
        await sidebar.selectIgnoreFields(ignoreFields);

        // --- submit and WAIT for the POST + the sidebar to close ---------------
        // Arm the response wait BEFORE clicking (the click only dispatches; the
        // form's POST /deduplications is async and only closes the panel on success).
        const createResp = page.waitForResponse(
            (r) =>
                r.url().includes("/deduplications") &&
                r.request().method() === "POST",
            { timeout: 30_000 }
        );
        await sidebar.submit();
        const resp = await createResp;
        expect(
            resp.ok(),
            `POST /deduplications failed: ${resp.status()} ${await resp.text().catch(() => "")}`
        ).toBeTruthy();
        await expect(sidebar.root).toBeHidden();

        // --- confirm the rule persisted via the API (and grab its id) ----------
        let rule: any;
        await expect
            .poll(
                async () => {
                    rule = (await api.deduplication.getDeduplicationRules()).find(
                        (r: any) => r.name === name
                    );
                    return Boolean(rule);
                },
                { timeout: 30_000, message: "deduplication rule to be created" }
            )
            .toBe(true);

        // --- validate the NAME via the UI --------------------------------------
        // The list table shows the description, not the name — the name is only
        // surfaced in the edit sidebar, so re-open the rule and assert its field.
        await deduplication.goto();
        await deduplication.waitForRulesLoaded();
        const editSidebar = await deduplication.openRule(rule.id);
        await expect(editSidebar.locators.nameInput).toHaveValue(name);
        await editSidebar.cancel();

        // --- validate the rest of the fields via the API -----------------------
        expect(rule.description).toBe(description);
        expect(rule.fingerprint_fields).toEqual(
            expect.arrayContaining(fingerprintFields)
        );
        expect(rule.full_deduplication).toBe(true);
        expect(rule.ignore_fields).toEqual(expect.arrayContaining(ignoreFields));
        expect(rule.provider_type).toBeTruthy(); // a real provider was selected
        expect(rule.default).toBe(false); // a user-created (custom) rule
    })

    test('activate deduplication rule', async ({ api }) => {
        const stamp = Date.now();

        // NOTE: this validates deduplication via the DEFAULT ("keep") rule, not a
        // custom one. On this stack a custom rule can't be exercised: there is no
        // installed alert provider, so every ingested alert falls into the built-in
        // "keep" dedup bucket, and a custom rule can't be created for that bucket.
        // So we prove dedup end-to-end through the default rule: two alerts sharing
        // one fingerprint (identical except last_received, which the default rule
        // ignores) collapse into a single alert with two received occurrences.
        const fingerprint = api.makeFingerprint(`dedup-${stamp}`);
        const seed = {
            name: `dedup-${stamp}`,
            source: ["e2e-dedup"],
            fingerprint,
        };

        // Baseline the default rule's ingested counter before sending.
        const ingestedBefore =
            (await api.deduplication.getDeduplicationRules()).find(
                (r: any) => r.default
            )?.ingested ?? 0;

        // Send the SAME alert twice → the second is a full duplicate of the first.
        await api.alerts.sendAlert(seed);
        await api.alerts.sendAlert(seed);

        // Ingest is async → poll. The two sends must land as TWO occurrences on ONE
        // fingerprint (i.e. deduplicated into a single alert, not two alert rows).
        await expect
            .poll(
                async () =>
                    (await api.alerts.getHistory(fingerprint)).occurrences.length,
                {
                    timeout: 30_000,
                    message: "two alerts to be deduplicated into one (2 occurrences)",
                }
            )
            .toBe(2);

        // The deduplicated alert exists as a single row for the fingerprint.
        const alert = await api.alerts.getAlert(fingerprint);
        expect(alert, "a single deduplicated alert to exist").toBeTruthy();

        // The default deduplication rule counted both ingested alerts.
        await expect
            .poll(
                async () =>
                    (await api.deduplication.getDeduplicationRules()).find(
                        (r: any) => r.default
                    )?.ingested ?? 0,
                {
                    timeout: 30_000,
                    message: "default deduplication rule ingested count to grow",
                }
            )
            .toBeGreaterThanOrEqual(ingestedBefore + 2);
    })
})
