import { test, expect } from "../fixtures/test-base";
import { AlertsFeedPage, celFingerprintIn } from "../pages";

/**
 * [check:02] change-status
 *
 * Drives the "Change Status" UI flow on the alerts feed, single-row and bulk:
 *   single: open the row action menu (ellipsis) → "Change Status" menu item →
 *     the change-status modal opens → pick "Acknowledged" → submit
 *     (POST /alerts/enrich).
 *   bulk:   select every alert → open the actions-toolbar "Change Status" →
 *     the same modal → pick "Acknowledged" → submit (POST /alerts/batch_enrich).
 *
 * Hybrid:
 *  - seed via api.alerts.sendAlert
 *  - mutate via the real UI (AlertsFeedPage / AlertRow / ChangeStatusModal)
 *  - backend-assert via api.alerts.waitForAlertField(fp, "status", "acknowledged")
 *  - render-assert the row's status cell.
 *
 * Also pins the "dispose on new alert" toggle default: the modal must open in
 * the "Keeping on new alerts" (false) state, and submitting WITHOUT touching
 * the toggle must POST /alerts/enrich (the single-alert path this flow takes)
 * with dispose_on_new_alert=false in the query string.
 */
test.describe("[check:02] change-status", () => {
  test("changing an alert's status via the UI persists and re-renders", async ({
    alertsFeed,
    page,
    api,
  }) => {
    const { fingerprint } = await api.alerts.sendAlert({ name: "sanity-status" });
    await api.alerts.waitForAlert(fingerprint);

    const row = await alertsFeed.loadFeedRow(fingerprint);
    await expect(row.root).toBeVisible();

    const modal = await row.openChangeStatusModal();

    await expect(modal.keepingToggle).toBeVisible();
    await expect(modal.disposingToggle).toHaveCount(0);

    await modal.selectStatus("Resolved");

    const enrichRequest = page.waitForRequest(
      (req) =>
        req.method() === "POST" && req.url().includes("/alerts/enrich"),
      { timeout: 15_000 }
    );
    await modal.submit();
    expect((await enrichRequest).url()).toContain("dispose_on_new_alert=false");
    await expect(modal.root).toBeHidden();

    await api.alerts.waitForAlertField(fingerprint, "status", "resolved");

    const statusCell = row.cell("status");
    await expect(statusCell).toBeVisible();
    await statusCell.hover();
    await expect(
      page.getByRole("tooltip").filter({ hasText: /resolved/i })
    ).toBeVisible();
  });

  test("bulk-changing status across all selected alerts persists for every one", async ({
    alertsFeed,
    page,
    api,
  }) => {
    const stamp = Date.now();

    const seeds = await Promise.all(
      [0, 1, 2].map((i) =>
        api.alerts.sendAlert({ name: `sanity-bulk-status-${stamp}-${i}` })
      )
    );
    const fingerprints = seeds.map((s) => s.fingerprint);
    await Promise.all(fingerprints.map((fp) => api.alerts.waitForAlert(fp)));

    // --- load the feed filtered to exactly the three seeded alerts ----------
    await alertsFeed.loadFeed(celFingerprintIn(fingerprints), fingerprints);
    await alertsFeed.selectAll();
    await expect(alertsFeed.actionsToolbar).toBeVisible();
    const modal = await alertsFeed.openBulkChangeStatusModal();
    await modal.selectStatus("Resolved");

    // Submit and assert the bulk path is taken: a multi-alert selection POSTs
    // /alerts/batch_enrich (the single-alert flow uses /alerts/enrich).
    const batchEnrichRequest = page.waitForRequest(
      (req) =>
        req.method() === "POST" && req.url().includes("/alerts/batch_enrich"),
      { timeout: 15_000 }
    );
    await modal.submit();
    await batchEnrichRequest;
    await expect(modal.root).toBeHidden();

    // --- backend assert: every selected alert changed to resolved -------
    for (const fp of fingerprints) {
      await api.alerts.waitForAlertField(fp, "status", "resolved");
    }

    // --- render assert: each row's status cell reflects the new status ------
    for (const fp of fingerprints) {
      const statusCell = alertsFeed.row(fp).cell("status");
      await expect(statusCell).toBeVisible();
      // Move the mouse off the table first: the previous row's status tooltip is
      // a portal that can overlap the next status cell and intercept the hover.
      await page.mouse.move(0, 0);
      await statusCell.hover();
      await expect(
        page.getByRole("tooltip").filter({ hasText: /resolved/i }).first()
      ).toBeVisible();
    }
  });

  test('change status keeping on new alerts', async({alertsFeed, page, api}) => {
    const { fingerprint }= await api.alerts.sendAlert({name: "change status - keeping on new alerts test"})
    await api.alerts.waitForAlert(fingerprint)

    // Action via UI: change status -> Resolved, "Keeping on new alerts".
    const row = await alertsFeed.loadFeedRow(fingerprint)
    const modal = await row.openChangeStatusModal()
    await modal.setDisposeOnNewAlert(false)
    await modal.selectStatus("Resolved")
    await modal.submit()
    await expect(modal.root).toBeHidden()
    await api.alerts.waitForAlertField(fingerprint, "status", "resolved")

    // A new alert arrives on the same fingerprint (trigger; no UI equivalent).
    await api.alerts.sendAlert({fingerprint: fingerprint})
    const originalStatus = await api.alerts.waitForAlertField(fingerprint, "status", "resolved")
    expect(originalStatus.status).toBe('resolved')

    await alertsFeed.loadFeedRow(fingerprint)
    const statusCell = alertsFeed.row(fingerprint).cell("status")
    await page.mouse.move(0, 0)
    await statusCell.hover()
    await expect(
      page.getByRole("tooltip").filter({ hasText: /resolved/i }).first()
    ).toBeVisible()


  })

  test('change status dispose on new alerts', async ({alertsFeed, page, api}) => {
    const { fingerprint } = await api.alerts.sendAlert({name: "change status - disposing test"})
    await api.alerts.waitForAlert(fingerprint)

    // Action via UI: change status -> Resolved, "Disposing on new alerts".
    const row = await alertsFeed.loadFeedRow(fingerprint)
    const modal = await row.openChangeStatusModal()
    await modal.setDisposeOnNewAlert(true)
    await modal.selectStatus("Resolved")
    await modal.submit()
    await expect(modal.root).toBeHidden()
    await api.alerts.waitForAlertField(fingerprint, "status", "resolved")

    // A new alert arrives on the same fingerprint (trigger; no UI equivalent).
    await api.alerts.sendAlert({fingerprint: fingerprint})

    const newStatus = await api.alerts.waitForAlertField(fingerprint, "status", "firing")
    expect(newStatus.status).toBe('firing')

    await alertsFeed.loadFeedRow(fingerprint)
    const statusCell = alertsFeed.row(fingerprint).cell('status')
    await page.mouse.move(0, 0)
    await statusCell.hover()
    await expect(
      page.getByRole("tooltip").filter({hasText: /firing/i }).first()
    ).toBeVisible()

  })
});
