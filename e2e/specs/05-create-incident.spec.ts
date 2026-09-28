import { test, expect } from "../fixtures/test-base";

/**
 * [check:05] create-incident
 *
 * Drives the real "Create Incident" UI flow on /incidents:
 *   open form → fill name + summary → submit.
 * Backend-asserts via api.incidents.getIncidents() that the new incident exists, and
 * render-asserts that it shows up in the incidents table.
 *
 * Optionally seeds one alert via api.alerts.sendAlert and attaches it to the created
 * incident via api.incidents.addAlertsToIncident to exercise the alerts-count path.
 */
test.describe("[check:05] create-incident", () => {
  test("creates an incident through the UI and it persists in the backend + list", async ({
    incidents,
    api,
  }) => {
    const stamp = Date.now();
    const incidentName = `sanity-incident-${stamp}`;
    const summaryText = `sanity summary ${stamp}`;

    // --- seed: one alert we can optionally attach ---------------------------
    const { fingerprint } = await api.alerts.sendAlert({
      name: `sanity-create-incident-${stamp}`,
      severity: "critical",
      status: "firing",
    });
    await api.alerts.waitForAlert(fingerprint);

    // --- drive the create-incident UI --------------------------------------
    await incidents.goto();

    const form = await incidents.openCreateForm();
    await form.fillName(incidentName);
    await form.fillSummary(summaryText);
    await form.submit();

    // --- backend assert: the incident exists with our name -----------------
    let created: any | undefined;
    await expect
      .poll(
        async () => {
          const list = await api.incidents.getIncidents();
          created = list.find((i) => i?.user_generated_name === incidentName);
          return Boolean(created);
        },
        { timeout: 30_000, message: "incident to appear in api.incidents.getIncidents()" }
      )
      .toBe(true);

    expect(created).toBeTruthy();
    expect(created.user_generated_name).toBe(incidentName);

    // --- optional: attach the seeded alert ---------------------------------
    await api.incidents.addAlertsToIncident(created.id, [fingerprint]);

    // --- render assert: the incident shows up in the UI list ----------------
    // Re-navigate (not a bare reload) until the new row renders; this also
    // recovers from the dev-mode client-side crash a reload can hit.
    await incidents.gotoAndExpectRow(incidentName);
  });
});
