import { test, expect } from "../fixtures/test-base";

/**
 * [check:09] application-column
 *
 * Seeds an alert carrying an extra `application` field (extra fields pass
 * straight through `sendAlert`), asserts the backend persisted it, then drives
 * the alerts feed to enable the `application` column via the table settings
 * popover and asserts the value renders in that row's cell.
 *
 * Settings flow (read from widgets/alerts-table/ui/SettingsSelection.tsx +
 * ColumnSelection.tsx): settings-button → tab-columns →
 * column-checkbox-application → alerts-columns-save-btn — encapsulated in
 * AlertsFeedPage.enableColumn().
 */
test.describe("[check:09] application-column", () => {
  test("seeded application value renders in the application column", async ({
    alertsFeed,
    api,
  }) => {
    const application = `sanity-app-${Date.now()}`;
    const name = `sanity-appcol-${Date.now()}`;

    // --- seed -------------------------------------------------------------
    const { fingerprint } = await api.alerts.sendAlert({ name, application });

    // --- backend assert ---------------------------------------------------
    const alert = await api.alerts.waitForEnrichment(
      fingerprint,
      (a) => a?.application === application,
      30_000,
      `application === ${application}`
    );
    expect(alert.application).toBe(application);

    // --- UI: open the feed and confirm the seeded row is present ----------
    // The feed only lists alerts once a CEL query is submitted; filter to this fp.
    const row = await alertsFeed.loadFeedRow(fingerprint);
    await expect(row.root).toBeVisible();

    // --- UI: add the `application` column via the settings popover --------
    await alertsFeed.enableColumn("application");

    // --- UI assert: the application cell for our row shows the value ------
    const applicationCell = row.cell("application");
    await expect(applicationCell).toBeVisible();
    await expect(applicationCell).toContainText(application);
  });
});
