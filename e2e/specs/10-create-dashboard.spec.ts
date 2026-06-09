import { test, expect } from "../fixtures/test-base";

/**
 * [check:10] create-dashboard
 *
 * There is no /dashboard index — a dashboard is created on the fly by
 * navigating to /dashboard/<name> and clicking Save (which POSTs /dashboard).
 * The create form has no name field on the create path: `dashboard_name`
 * defaults to the decoded URL segment (app/(keep)/dashboard/[id]/dashboard.tsx),
 * so we navigate to a unique name and persist it via the save button.
 *
 * Backend assert: api.getDashboards() contains the new dashboard name.
 * UI assert: the dashboard page renders with that name and it appears as a
 * sidebar nav link.
 */
test.describe("[check:10] create-dashboard", () => {
  test("creating a dashboard persists it and renders the page", async ({ page, api }) => {
    const dashboardName = `sanity-dashboard-${Date.now()}`;

    // --- UI: drive the on-the-fly create flow ----------------------------
    // Navigating to /dashboard/<name> opens a brand-new (unsaved) dashboard
    // whose name is taken from the URL segment.
    await page.goto(`/dashboard/${encodeURIComponent(dashboardName)}`);

    const dashboardPage = page.locator('[data-cy="dashboard-page"]');
    await expect(dashboardPage).toBeVisible();
    await expect(page.locator('[data-cy="dashboard-name"]')).toHaveText(dashboardName);

    // Save persists the (empty-layout) dashboard via POST /dashboard. The save
    // handler depends on the page's data layer being ready, which can lag the
    // first render in dev — so re-click Save until the dashboard is persisted
    // (backend assert) rather than clicking once and hoping.
    const saveBtn = page.locator('[data-cy="dashboard-save-layout-btn"]');
    await expect(saveBtn).toBeVisible();
    await expect(async () => {
      await saveBtn.click();
      const names = (await api.getDashboards()).map((d: any) => d.dashboard_name);
      expect(names).toContain(dashboardName);
    }).toPass({ timeout: 30_000, intervals: [1_500, 3_000, 5_000] });

    // --- UI assert: the dashboard renders and is navigable ----------------
    await expect(page.locator('[data-cy="dashboard-name"]')).toHaveText(dashboardName);

    // Sidebar link for the saved dashboard (DashboardLink renders the name).
    const navLink = page
      .locator('[data-cy^="nav-link-dashboard-"]')
      .filter({ hasText: dashboardName });
    await expect(navLink.first()).toBeVisible();
  });
});
