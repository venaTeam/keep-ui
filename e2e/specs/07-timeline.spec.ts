import { test, expect } from "../fixtures/test-base";

/**
 * [check:07] timeline
 *
 * Seeds one alert, attaches it to a fresh incident, then performs an ORDERED
 * set of mutations through the API (status change → note) with small awaits so
 * the audit-trail ordering is deterministic.
 *
 * Backend assert: api.getHistory(fp).activity returns >= N events whose
 * timestamps are monotonic non-decreasing.
 * UI assert: the incident Timeline tab (data-cy="incidents-timeline") renders,
 * and the incident Activity tab (data-cy="incidents-activity-card") shows
 * >= N activity items.
 */
test.describe("[check:07] timeline", () => {
  test("ordered alert mutations produce a monotonic, rendered timeline", async ({
    page,
    api,
  }) => {
    const stamp = Date.now();

    // --- seed: one alert ----------------------------------------------------
    const { fingerprint } = await api.sendAlert({
      name: `sanity-timeline-${stamp}`,
      severity: "critical",
      status: "firing",
    });
    await api.waitForAlert(fingerprint);

    // --- seed: an incident the alert belongs to -----------------------------
    const incident = await api.createIncident({
      user_generated_name: `sanity-timeline-incident-${stamp}`,
      user_summary: `timeline check ${stamp}`,
    });
    await api.addAlertsToIncident(incident.id, [fingerprint]);

    // --- ordered mutations (deterministic ordering via awaits) --------------
    const settle = () => new Promise((r) => setTimeout(r, 1_500));

    await api.changeStatus(fingerprint, "acknowledged");
    await api.waitForAlertField(fingerprint, "status", "acknowledged");
    await settle();

    await api.addNote(fingerprint, `sanity timeline note ${stamp}`);
    await settle();

    await api.changeStatus(fingerprint, "resolved");
    await api.waitForAlertField(fingerprint, "status", "resolved");

    // --- backend assert: ordered history -----------------------------------
    const EXPECTED_MIN_EVENTS = 3;
    let activity: any[] = [];
    await expect
      .poll(
        async () => {
          activity = (await api.getHistory(fingerprint)).activity ?? [];
          return activity.length;
        },
        {
          timeout: 30_000,
          message: `>= ${EXPECTED_MIN_EVENTS} activity events in history`,
        }
      )
      .toBeGreaterThanOrEqual(EXPECTED_MIN_EVENTS);

    // timestamps must be monotonic non-decreasing (ordered by time)
    const timestamps = activity
      .map((e) => new Date(e.timestamp).getTime())
      .filter((t) => !Number.isNaN(t));
    expect(timestamps.length).toBeGreaterThanOrEqual(EXPECTED_MIN_EVENTS);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }

    // --- render assert: incident Timeline tab -------------------------------
    await page.goto(`/incidents/${incident.id}/timeline`);
    await expect(
      page.locator('[data-cy="incidents-timeline"]')
    ).toBeVisible();

    // --- render assert: incident Activity tab shows >= N items --------------
    // The activity feed renders one item per audit event
    // (data-cy="incidents-activity-item-<id>"), a reliable per-entry target.
    await page.goto(`/incidents/${incident.id}/activity`);
    await expect(
      page.locator('[data-cy="incidents-activity-card"]')
    ).toBeVisible();
    const activityItems = page.locator(
      '[data-cy^="incidents-activity-item-"]'
    );
    await expect(activityItems.first()).toBeVisible();
    await expect
      .poll(() => activityItems.count(), {
        timeout: 30_000,
        message: `>= ${EXPECTED_MIN_EVENTS} rendered activity items`,
      })
      .toBeGreaterThanOrEqual(EXPECTED_MIN_EVENTS);
  });
});
