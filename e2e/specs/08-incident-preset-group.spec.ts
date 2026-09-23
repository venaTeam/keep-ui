import { test, expect } from "../fixtures/test-base";
import { celFingerprintIn } from "../pages";

/**
 * [check:08] incident-preset-group
 *
 * Groups ALERTS on the feed by an added "incident" column — the intended
 *
 * Flow (all on the alerts feed / preset):
 *   1. seed one incident + three alerts; attach two of them to the incident and
 *      leave the third unattached.
 *   2. load the feed filtered to the three seeded alerts.
 *   3. add the "incident" column via the settings popover (enableColumn).
 *   4. open that column's header menu → "Group by".
 *
 * How the grouping segments (widgets/alerts-table):
 *   The generated column has `getGroupingValue` that collapses object-valued
 *   cells (an alert's incident list) into a single "object" bucket, while
 *   unattached alerts (no incident value) fall into the "No Incidents" bucket
 *   (alert-grouped-row.tsx). So the two attached alerts collapse into one group
 *   labelled with the incident name, and the unattached alert forms the
 *   "No Incidents" group — exactly two groups.
 *
 * Cleanup: the settings popover's "Reset" button restores the default columns
 * AND clears grouping (its handler calls onResetGrouping). It only appears once
 * the view is customized, which it is after we add the column — so we click it
 * at the end regardless of pass/fail via resetTableSettings().
 */
test.describe("[check:08] incident-preset-group", () => {
  test("groups alerts on the feed by an added incident column", async ({
    alertsFeed,
    api,
  }) => {
    const stamp = Date.now();
    const incidentName = `sanity-group-incident-${stamp}`;

    // --- seed: one incident + three alerts (2 attached, 1 unattached) ------
    const incident = await api.incidents.createIncident({
      user_generated_name: incidentName,
      user_summary: `group check ${stamp}`,
    });

    const attached = await Promise.all(
      [0, 1].map((i) =>
        api.alerts.sendAlert({ name: `sanity-group-attached-${stamp}-${i}` })
      )
    );
    const loose = await api.alerts.sendAlert({ name: `sanity-group-loose-${stamp}` });

    const attachedFps = attached.map((a) => a.fingerprint);
    const allFps = [...attachedFps, loose.fingerprint];
    await Promise.all(allFps.map((fp) => api.alerts.waitForAlert(fp)));

    await api.incidents.addAlertsToIncident(incident.id, attachedFps);

    // backend gate: the incident reports both alerts attached before we drive UI
    await expect
      .poll(
        async () => {
          const list = await api.incidents.getIncidents();
          const found = list.find((i) => i?.user_generated_name === incidentName);
          return found?.alerts_count ?? 0;
        },
        { timeout: 30_000, message: "incident to report its 2 attached alerts" }
      )
      .toBeGreaterThanOrEqual(2);

    // --- UI: load the feed filtered to the three seeded alerts -------------
    // The feed only lists alerts once a CEL query is submitted; scope it to our
    // three fingerprints so the grouped counts are deterministic.
    await alertsFeed.loadFeed(celFingerprintIn(allFps), allFps);

    // --- UI: add the incident column, then group the feed by it -----------
    await alertsFeed.enableColumn("incident");
    await alertsFeed.groupByColumn("incident");

    // --- assert: exactly two groups form ----------------------------------
    // (Web-first assertions poll, so this settles once the feed's incident data
    // has loaded and the rows regroup.)
    await expect(alertsFeed.groupHeaders()).toHaveCount(2);

    // the attached alerts collapse into one group labelled with the incident
    // name, carrying both alerts
    const incidentGroup = alertsFeed.groupHeader(incidentName);
    await expect(incidentGroup).toBeVisible();
    await expect(incidentGroup).toContainText("2 alerts");

    // the unattached alert forms the "No Incidents" group
    const noIncidentGroup = alertsFeed.groupHeader("No Incidents");
    await expect(noIncidentGroup).toBeVisible();
    await expect(noIncidentGroup).toContainText("1 alert");

    // all three seeded alerts still render as child rows under the groups
    for (const fp of allFps) {
      await expect(alertsFeed.row(fp).root).toBeVisible();
    }

    // --- cleanup: reset columns + grouping to default via the settings UI --
    await alertsFeed.resetTableSettings();
    await expect(alertsFeed.groupHeaders()).toHaveCount(0);
  });
});
