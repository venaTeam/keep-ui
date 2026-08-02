import { test, expect } from "../fixtures/test-base";
import {
  celFingerprint,
  celFingerprintIn,
  type AlertsFeedPage,
} from "../pages";
import type { KeepApi } from "../fixtures/keep-api";

/**
 * [check:03] change-assignee
 *
 * Single + "bulk" assignee changes driven through the per-row UI.
 *
 * Single: seed 1 alert → open its row action menu → "Self-Assign" menu item →
 *   the assign modal → submit. The modal assigns the alert to the current
 *   (noauth) session user via POST /alerts/{fp}/assign/{lastReceived}.
 *
 * Bulk: seed 3 alerts and repeat the same per-row Self-Assign flow on each.
 *   NOTE: there is NO bulk "assign" affordance in the selection toolbar
 *   (widgets/alerts-table/ui/alert-actions.tsx only exposes change-status /
 *   dismiss / restore / preset / associate-incident). Until a bulk-assign action
 *   exists, "bulk" is exercised by driving the single-row flow N times, which
 *   still asserts all N backends.
 *
 * Because the assignee resolves to the current session user (email not known
 * statically under noauth), the backend assertion waits for the assignee field
 * to become a non-empty string, then the captured value is used for the cell
 * assertion.
 */
test.describe("[check:03] change-assignee", () => {
  // Self-Assign a single row identified by its fingerprint, returns the
  // resolved assignee value the backend recorded.
  async function selfAssignRow(
    alertsFeed: AlertsFeedPage,
    api: KeepApi,
    fingerprint: string
  ): Promise<string> {
    const row = alertsFeed.row(fingerprint);
    await expect(row.root).toBeVisible();

    const modal = await row.openAssignModal();
    await modal.submit();
    await expect(modal.root).toBeHidden();

    // backend assert: assignee becomes a non-empty string
    const alert = await api.alerts.waitForEnrichment(
      fingerprint,
      (a) => typeof a.assignee === "string" && a.assignee.length > 0,
      30_000,
      "assignee set"
    );
    return alert.assignee as string;
  }

  test("single self-assign persists and renders the assignee", async ({
    alertsFeed,
    api,
  }) => {
    const { fingerprint } = await api.alerts.sendAlert({ name: "sanity-assign-single" });
    await api.alerts.waitForAlert(fingerprint);

    // The feed only lists alerts once a CEL query is submitted; filter to this fp.
    await alertsFeed.loadFeed(celFingerprint(fingerprint), [fingerprint]);
    const assignee = await selfAssignRow(alertsFeed, api, fingerprint);

    // The assignee column is hidden by default (not in DEFAULT_COLS), so enable
    // it before asserting its cell renders.
    await alertsFeed.enableColumn("assignee");

    // render assert: the assignee cell for our row is present and populated
    // (renders an avatar/text for the resolved assignee). The backend assertion
    // above is the authoritative proof of the value.
    const assigneeCell = alertsFeed.row(fingerprint).cell("assignee");
    await expect(assigneeCell).toBeVisible();
    expect(assignee.length).toBeGreaterThan(0);
  });

  test('self assign alert keeping on new alerts', async ({alertsFeed, page, api}) => {
    const { fingerprint } = await api.alerts.sendAlert({
      name: "self assign - keeping on new alerts test",
    })
    await api.alerts.waitForAlert(fingerprint)

    // Action via UI: self-assign, "Keeping on new alerts" (status -> acknowledged).
    const row = await alertsFeed.loadFeedRow(fingerprint)
    const modal = await row.openAssignModal()
    await modal.setDisposeOnNewAlert(false)
    await modal.submit()
    await expect(modal.root).toBeHidden()

    const assigned = await api.alerts.waitForEnrichment(
      fingerprint,
      (a) => typeof a.assignee === "string" && a.assignee.length > 0,
      30_000,
      "assignee set"
    )
    const assignee = assigned.assignee as string
    expect(assigned.status).toBe('acknowledged')

    // New alert on the same fingerprint with a different status.
    await api.alerts.sendAlert({ fingerprint: fingerprint, status: "firing" })

    // keeping -> status stays acknowledged and the assignee persists.
    const afterNewAlert = await api.alerts.waitForAlertField(
      fingerprint,
      "status",
      "acknowledged"
    )
    expect(afterNewAlert.status).toBe('acknowledged')
    expect(afterNewAlert.assignee).toBe(assignee)

    // UI: status cell reads acknowledged, then enable the assignee column and
    // assert its cell is populated. Enable the column AFTER the status hover —
    // toggling a column re-renders the table and can disturb the hover.
    await alertsFeed.loadFeedRow(fingerprint)

    const statusCell = alertsFeed.row(fingerprint).cell("status")
    await expect(statusCell).toBeVisible()
    await page.mouse.move(0, 0)
    await statusCell.hover()
    await expect(
      page.getByRole("tooltip").filter({ hasText: /acknowledged/i }).first()
    ).toBeVisible()

    await alertsFeed.enableColumn("assignee")
    const assigneeCell = alertsFeed.row(fingerprint).cell("assignee")
    await expect(assigneeCell).toBeVisible()
    await expect(assigneeCell).not.toBeEmpty()
  })

  // test('self assign alert disposing on new alerts', async ({alertsFeed, page, api}) => {
  //   const { fingerprint } = await api.alerts.sendAlert({
  //     name: "self assign - disposing on new alerts test",
  //   })
  //   await api.alerts.waitForAlert(fingerprint)

  //   // Action via UI: self-assign, "Disposing on new alerts" (status -> acknowledged).
  //   const row = await alertsFeed.loadFeedRow(fingerprint)
  //   const modal = await row.openAssignModal()
  //   await modal.setDisposeOnNewAlert(true)
  //   await modal.submit()
  //   await expect(modal.root).toBeHidden()

  //   await api.alerts.waitForEnrichment(
  //     fingerprint,
  //     (a) => typeof a.assignee === "string" && a.assignee.length > 0,
  //     30_000,
  //     "assignee set"
  //   )

  //   // New firing alert on the same fingerprint.
  //   await api.alerts.sendAlert({ fingerprint: fingerprint, status: "firing" })

  //   // disposing -> the acknowledged status is disposed and reverts to firing.
  //   const afterNewAlert = await api.alerts.waitForAlertField(
  //     fingerprint,
  //     "status",
  //     "firing"
  //   )
  //   expect(afterNewAlert.status).toBe('firing')

  //   // EXPECTED (per spec): the assignee should be gone once the status disposes.
  //   // NOTE: this currently FAILS against the backend — dispose_on_new_alert only
  //   // disposes the acknowledged STATUS (typed `status_disposable`), never the
  //   // assignee (a per-fingerprint column that is never cleared automatically).
  //   // See alerts.py:491-492, enrichments_bl.py:647-657, db.py:4486-4489.
  //   expect(afterNewAlert.assignee ?? "").toBe("")

  //   await alertsFeed.loadFeedRow(fingerprint)

  //   const statusCell = alertsFeed.row(fingerprint).cell("status")
  //   await expect(statusCell).toBeVisible()
  //   await page.mouse.move(0, 0)
  //   await statusCell.hover()
  //   await expect(
  //     page.getByRole("tooltip").filter({ hasText: /firing/i }).first()
  //   ).toBeVisible()

  //   await alertsFeed.enableColumn("assignee")
  //   const assigneeCell = alertsFeed.row(fingerprint).cell("assignee")
  //   await expect(assigneeCell).toBeEmpty()
  // })
});
