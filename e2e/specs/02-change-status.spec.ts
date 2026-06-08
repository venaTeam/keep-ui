import { test, expect } from "../fixtures/test-base";

/**
 * [check:02] change-status
 *
 * Drives the per-row "Change Status" UI flow on the alerts feed:
 *   open the row action menu (ellipsis) → click the "Change Status" menu item
 *   (DropdownMenu.Item auto-generates data-cy="menu-item-change-status") →
 *   the change-status modal (data-cy="alerts-change-status-modal") opens →
 *   pick "Acknowledged" from the react-select control → submit
 *   (data-cy="alerts-change-status-submit-btn").
 *
 * Hybrid:
 *  - seed via api.sendAlert
 *  - mutate via the real UI
 *  - backend-assert via api.waitForAlertField(fp, "status", "acknowledged")
 *  - render-assert the row's status cell (data-cy="alerts-cell-status").
 */
test.describe("[check:02] change-status", () => {
  test("changing an alert's status via the UI persists and re-renders", async ({
    page,
    api,
  }) => {
    // --- seed: one firing alert ---------------------------------------------
    const { fingerprint } = await api.sendAlert({ name: "sanity-status" });
    await api.waitForAlert(fingerprint);

    // --- locate its row in the feed -----------------------------------------
    await page.goto("/alerts/feed");
    const row = page.locator(
      `[data-cy="alerts-row"][data-cy-id="${fingerprint}"]`
    );
    await expect(row).toBeVisible();

    // --- open the row action menu and pick "Change Status" ------------------
    // The ellipsis trigger lives inside the row's alerts-menu wrapper.
    await row
      .locator('[data-cy="alerts-menu"] [data-testid="dropdown-menu-button"]')
      .click();
    // The menu renders into a FloatingPortal at the document root, so target
    // the item page-wide by its auto-generated data-cy.
    await page.locator('[data-cy="menu-item-change-status"]').click();

    // --- drive the change-status modal --------------------------------------
    const modal = page.locator('[data-cy="alerts-change-status-modal"]');
    await expect(modal).toBeVisible();

    // The status picker is a react-select; open it via its placeholder and
    // choose the "Acknowledged" option by its accessible text.
    await modal.getByText("Select new status").click();
    await page.getByRole("option", { name: "Acknowledged" }).click();

    await modal.locator('[data-cy="alerts-change-status-submit-btn"]').click();
    await expect(modal).toBeHidden();

    // --- backend assert: status changed -------------------------------------
    await api.waitForAlertField(fingerprint, "status", "acknowledged");

    // --- render assert: the status cell reflects the new status -------------
    // The status cell renders an Icon with tooltip={status}; assert the cell's
    // title attribute surfaces "acknowledged".
    const statusCell = row.locator('[data-cy="alerts-cell-status"]');
    await expect(statusCell).toBeVisible();
    await expect(statusCell.locator('[title="acknowledged"]')).toBeVisible();
  });
});
