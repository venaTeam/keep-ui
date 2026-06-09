import { test, expect } from "../fixtures/test-base";

/**
 * [check:05] create-incident
 *
 * Drives the real "Create Incident" UI flow on /incidents:
 *   open form → fill name + summary → submit.
 * Backend-asserts via api.getIncidents() that the new incident exists, and
 * render-asserts that it shows up in the incidents table.
 *
 * Optionally seeds one alert via api.sendAlert and attaches it to the created
 * incident via api.addAlertsToIncident to exercise the alerts-count path.
 */
test.describe("[check:05] create-incident", () => {
  test("creates an incident through the UI and it persists in the backend + list", async ({
    page,
    api,
  }) => {
    const stamp = Date.now();
    const incidentName = `sanity-incident-${stamp}`;
    const summaryText = `sanity summary ${stamp}`;

    // --- seed: one alert we can optionally attach ---------------------------
    const { fingerprint } = await api.sendAlert({
      name: `sanity-create-incident-${stamp}`,
      severity: "critical",
      status: "firing",
    });
    await api.waitForAlert(fingerprint);

    // --- drive the create-incident UI --------------------------------------
    await page.goto("/incidents");

    // Open the create form (modal). The list has a create button both in the
    // header and the empty-state placeholder; either opens the same modal.
    await page.locator('[data-cy="incidents-action-create-btn"]').first().click();

    const form = page.locator('[data-cy="incidents-form"]');
    await expect(form).toBeVisible();

    await form.locator('[data-cy="incidents-form-name-input"]').fill(incidentName);

    // Summary is a ReactQuill rich-text editor. NOTE: react-quill-new does NOT
    // forward the `data-cy="incidents-form-summary-input"` prop to the DOM, so
    // target its contenteditable `.ql-editor` within the form directly. It is
    // dynamically imported (ssr:false) and compiles lazily in dev, so wait for
    // it to mount before typing.
    const summaryEditor = form.locator(".ql-editor").first();
    await summaryEditor.waitFor({ state: "visible", timeout: 45_000 });
    await summaryEditor.click();
    await summaryEditor.fill(summaryText);

    await form.locator('[data-cy="incidents-form-submit-btn"]').click();

    // --- backend assert: the incident exists with our name -----------------
    let created: any | undefined;
    await expect
      .poll(
        async () => {
          const incidents = await api.getIncidents();
          created = incidents.find(
            (i) => i?.user_generated_name === incidentName
          );
          return Boolean(created);
        },
        { timeout: 30_000, message: "incident to appear in api.getIncidents()" }
      )
      .toBe(true);

    expect(created).toBeTruthy();
    expect(created.user_generated_name).toBe(incidentName);

    // --- optional: attach the seeded alert ---------------------------------
    await api.addAlertsToIncident(created.id, [fingerprint]);

    // --- render assert: the incident shows up in the UI list ----------------
    // The list may need a reload to pick up the freshly created row.
    await page.reload();
    await expect(
      page.locator('[data-cy="incidents-table"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-cy="incidents-row"]', { hasText: incidentName })
    ).toBeVisible();
  });
});
