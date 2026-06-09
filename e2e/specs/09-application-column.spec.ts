import { test, expect } from "../fixtures/test-base";
import { loadFeedRow } from "../fixtures/ui";

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
 * column-checkbox-application → alerts-columns-save-btn.
 */
test.describe("[check:09] application-column", () => {
  test("seeded application value renders in the application column", async ({ page, api }) => {
    const application = `sanity-app-${Date.now()}`;
    const name = `sanity-appcol-${Date.now()}`;

    // --- seed -------------------------------------------------------------
    const { fingerprint } = await api.sendAlert({ name, application });

    // --- backend assert ---------------------------------------------------
    const alert = await api.waitForEnrichment(
      fingerprint,
      (a) => a?.application === application,
      30_000,
      `application === ${application}`
    );
    expect(alert.application).toBe(application);

    // --- UI: open the feed and confirm the seeded row is present ----------
    // The feed only lists alerts once a CEL query is submitted; filter to this fp.
    const row = await loadFeedRow(page, fingerprint);
    await expect(row).toBeVisible();

    // --- UI: add the `application` column via the settings popover --------
    await page.locator('[data-cy="settings-button"]').click();
    await expect(page.locator('[data-cy="settings-panel"]')).toBeVisible();

    await page.locator('[data-cy="tab-columns"]').click();
    await expect(page.locator('[data-cy="panel-columns"]')).toBeVisible();

    const applicationCheckbox = page.locator('[data-cy="column-checkbox-application"]');
    await expect(applicationCheckbox).toBeVisible();
    // Only toggle on if it is not already enabled.
    if (!(await applicationCheckbox.isChecked())) {
      await applicationCheckbox.check();
    }

    await page.locator('[data-cy="alerts-columns-save-btn"]').click();

    // --- UI assert: the application cell for our row shows the value ------
    const applicationCell = row.locator('[data-cy="alerts-cell-application"]');
    await expect(applicationCell).toBeVisible();
    await expect(applicationCell).toContainText(application);
  });
});
