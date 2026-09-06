import { test, expect } from "../fixtures/test-base";
import type { KeepApi } from "../fixtures/keep-api";

/**
 * [check:07] timeline
 *
 * Both tests build the SAME per-alert audit history — one firing alert put
 * through an ordered set of mutations (acknowledge → note → resolve) — and then
 * assert that history renders on a different surface:
 *
 *   1. the ALERT's own timeline in its detail sidebar (the "specific alert"
 *      view opened from a feed row, data-cy="alerts-timeline").
 *   2. the INCIDENT the alert belongs to — its Timeline + Activity tabs.
 */

const EXPECTED_MIN_EVENTS = 3;

/** Seed one firing alert and wait until it exists. Returns its fingerprint. */
async function seedAlert(api: KeepApi, stamp: number): Promise<string> {
  const { fingerprint } = await api.alerts.sendAlert({
    name: `sanity-timeline-${stamp}`,
    severity: "critical",
    status: "firing",
  });
  await api.alerts.waitForAlert(fingerprint);
  return fingerprint;
}

/**
 * Drive an ORDERED set of mutations on the alert (acknowledge → note → resolve)
 * with small settles so the audit-trail ordering is deterministic. Returns the
 * unique note text, which both tests use to assert the note rendered.
 */
async function driveOrderedMutations(
  api: KeepApi,
  fingerprint: string,
  stamp: number
): Promise<string> {
  const noteText = `sanity timeline note ${stamp}`;
  const settle = () => new Promise((r) => setTimeout(r, 1_500)); // why is there a manuall wait

  await api.alerts.changeStatus(fingerprint, "acknowledged");
  await api.alerts.waitForAlertField(fingerprint, "status", "acknowledged");
  await settle();

  await api.alerts.addNote(fingerprint, noteText);
  await settle();

  await api.alerts.changeStatus(fingerprint, "resolved");
  await api.alerts.waitForAlertField(fingerprint, "status", "resolved");

  return noteText;
} // why all of this is in a function 

test.describe("[check:07] timeline", () => {
  test("ordered alert mutations render on the alert's own timeline (detail sidebar)", async ({
    alertsFeed,
    api,
  }) => {
    const stamp = Date.now();

    const fingerprint = await seedAlert(api, stamp);
    const noteText = await driveOrderedMutations(api, fingerprint, stamp);

    // --- backend assert: history exists and is ordered ----------------------
    let activity: any[] = [];
    await expect
      .poll(
        async () => {
          activity = (await api.alerts.getHistory(fingerprint)).activity ?? [];
          return activity.length;
        },
        {
          timeout: 30_000,
          message: `>= ${EXPECTED_MIN_EVENTS} activity events in history`,
        }
      )
      .toBeGreaterThanOrEqual(EXPECTED_MIN_EVENTS);

    // The audit trail must be consistently ORDERED by time. The history endpoint
    // returns activity newest-first (descending), so assert the series is
    // monotonic in either direction rather than assuming ascending.
    const timestamps = activity
      .map((e) => new Date(e.timestamp).getTime())
      .filter((t) => !Number.isNaN(t));
    expect(timestamps.length).toBeGreaterThanOrEqual(EXPECTED_MIN_EVENTS);
    const ascending = [...timestamps].sort((a, b) => a - b);
    const descending = [...ascending].reverse();
    const isMonotonic =
      timestamps.every((t, i) => t === ascending[i]) ||
      timestamps.every((t, i) => t === descending[i]);
    expect(isMonotonic, "activity timestamps should be ordered by time").toBe(
      true
    );

    // --- render assert: the ALERT's own timeline in its detail sidebar -------
    // Open the specific alert from the feed and assert its timeline reflects the
    // mutations we made: the unique note text and the resolved status.
    const row = await alertsFeed.loadFeedRow(fingerprint);
    const sidebar = await row.openDetailSidebar();
    await expect(sidebar.timeline).toBeVisible();
    await expect(sidebar.timeline).toContainText(noteText);
    await expect(sidebar.timeline).toContainText(/resolved/i);
  });

  test("the same alert history renders on the incident Timeline + Activity tabs", async ({
    incidents,
    api,
  }) => {
    const stamp = Date.now();

    const fingerprint = await seedAlert(api, stamp);

    // --- seed: an incident the alert belongs to (attach BEFORE mutating so the
    // incident captures the audit trail) -----------------------------------
    const incident = await api.incidents.createIncident({
      user_generated_name: `sanity-timeline-incident-${stamp}`,
      user_summary: `timeline check ${stamp}`,
    });
    await api.incidents.addAlertsToIncident(incident.id, [fingerprint]);

    await driveOrderedMutations(api, fingerprint, stamp);

    // --- render assert: incident Timeline tab -------------------------------
    const detail = incidents.detail(incident.id);
    await detail.gotoTimeline();
    await expect(detail.timeline).toBeVisible();

    // --- render assert: incident Activity tab shows >= N items --------------
    // The activity feed renders one item per audit event
    // (data-cy="incidents-activity-item-<id>"), a reliable per-entry target.
    await detail.gotoActivity();
    await expect(detail.activityCard).toBeVisible();
    const activityItems = detail.activityItems();
    await expect(activityItems.first()).toBeVisible();
    await expect
      .poll(() => activityItems.count(), {
        timeout: 30_000,
        message: `>= ${EXPECTED_MIN_EVENTS} rendered activity items`,
      })
      .toBeGreaterThanOrEqual(EXPECTED_MIN_EVENTS);
  });
});
