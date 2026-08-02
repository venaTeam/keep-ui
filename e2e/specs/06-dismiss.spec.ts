import { test, expect } from "../fixtures/test-base";
import { celFingerprint, type AlertRow } from "../pages";
import type { Page } from "@playwright/test";

/**
 * [check:06] dismiss — two independent flows, one test each. Each hybrid-asserts:
 * backend truth via the API, then the UI render.
 *
 *   #1 permanent ("Dismiss Forever"): dismiss through the UI; assert the alert
 *      enriches to status=suppressed / dismiss_mode=permanent, and the row shows
 *      suppressed.
 *   #2 dismiss-until: the UI datetime picker only steps in 15-minute jumps, so the
 *      dismiss ACTION is issued via the API for a short real window (~30s); the UI
 *      only VALIDATES. The alert must show suppressed within the window and return
 *      to firing once it expires.
 *
 * Reading UI status: the status cell renders <Icon tooltip={status}>
 * (alert-table-utils.tsx), so we hover the row's status cell and read the tooltip.
 * A freshly-dismissed (suppressed) alert lags in a FRESH feed load, so suppressed
 * states are read IN PLACE on the already-rendered row (loaded while firing)
 * rather than by re-navigating. A firing alert indexes normally, so the final
 * return-to-firing check can reload the feed.
 */

/**
 * Assert the row's status cell tooltip matches `status`. Polls in place (no
 * reload): move off the status cell, then back onto it, so the tooltip re-renders
 * the row's current status each attempt.
 */
async function expectRowStatus(
  page: Page,
  row: AlertRow,
  status: RegExp,
  timeoutMs = 20_000
): Promise<void> {
  await expect(async () => {
    await row.cell("severity").hover();
    await row.cell("status").hover();
    await expect(
      page.getByRole("tooltip").filter({ hasText: status })
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: timeoutMs, intervals: [1_000, 2_000, 3_000] });
}

test.describe("[check:06] dismiss", () => {
  test("permanent dismiss suppresses the alert", async ({
    alertsFeed,
    page,
    api,
  }) => {
    const stamp = Date.now();

    const { fingerprint } = await api.alerts.sendAlert({
      name: `sanity-dismiss-perm-${stamp}`,
    });
    await api.alerts.waitForAlert(fingerprint);

    // Render the row while firing, then dismiss it "forever" through the UI.
    await alertsFeed.loadFeed(celFingerprint(fingerprint), [fingerprint]);
    const row = alertsFeed.row(fingerprint);
    const modal = await row.openDismissModal();
    // "Dismiss Forever" is the default tab; a dismiss comment is required.
    await modal.comment.fill(`permanent dismiss ${stamp}`);
    await modal.submit();
    await expect(modal.root).toBeHidden();

    // Backend assert: the alert enriches to suppressed + permanent dismiss.
    await api.alerts.waitForEnrichment(
      fingerprint,
      (a) =>
        a.status === "suppressed" &&
        (a.dismiss_mode === "permanent" || a.dismissed === true),
      30_000,
      "permanent dismiss → status=suppressed, dismiss_mode=permanent"
    );

    // UI render assert: the row's status shows suppressed (read in place).
    await expectRowStatus(page, row, /suppressed/i);
  });

  test("dismiss-until suppresses the alert, then it returns to firing when the window expires", async ({
    alertsFeed,
    page,
    api,
  }) => {
    const stamp = Date.now();
    const DISMISS_MS = 30_000;

    const { fingerprint } = await api.alerts.sendAlert({
      name: `sanity-dismiss-until-${stamp}`,
    });
    await api.alerts.waitForAlert(fingerprint);

    // Render the row while firing so its status can be read in place afterwards.
    await alertsFeed.loadFeed(celFingerprint(fingerprint), [fingerprint]);
    const row = alertsFeed.row(fingerprint);

    // Action via API: dismiss for a short real window (the UI datetime picker only
    // steps in 15-minute jumps, so the action is API-driven and only validated in UI).
    const dismissedUntil = new Date(Date.now() + DISMISS_MS).toISOString();
    await api.alerts.dismiss(fingerprint, "dismiss_until", { until: dismissedUntil });

    // Backend assert: the alert is suppressed with a dismissed_until set.
    await api.alerts.waitForEnrichment(
      fingerprint,
      (a) => a.status === "suppressed" && Boolean(a.dismissed_until),
      30_000,
      "dismiss-until → status=suppressed, dismissed_until set"
    );

    // UI render assert (in place): the row shows suppressed while within the window.
    await expectRowStatus(page, row, /suppressed/i);

    // --- after the window expires, the alert must return to firing -------------
    // Backend assert: status returns to firing once dismissed_until passes.
    await api.alerts.waitForAlertField(fingerprint, "status", "firing", DISMISS_MS + 30_000);

    // UI render assert: the row reflects firing again. A firing alert indexes
    // normally, so a fresh feed load surfaces it reliably here.
    await alertsFeed.loadFeed(celFingerprint(fingerprint), [fingerprint]);
    await expectRowStatus(page, alertsFeed.row(fingerprint), /firing/i);
  });

  test('dismiss alert keeping on new alerts', async({alertsFeed, page, api}) => {
    const { fingerprint } = await api.alerts.sendAlert({name: "dismiss alert - keeping"})
    await api.alerts.waitForAlert(fingerprint)

    // Action via UI: dismiss "forever", "Keeping on new alerts".
    const row = await alertsFeed.loadFeedRow(fingerprint)
    const modal = await row.openDismissModal()
    await modal.setDisposeOnNewAlert(false)
    await modal.comment.fill("keeping dismiss")
    await modal.submit()
    await expect(modal.root).toBeHidden()
    await api.alerts.waitForAlertField(fingerprint, "status", "suppressed")

    // A new alert arrives on the same fingerprint (trigger; no UI equivalent).
    await api.alerts.sendAlert({fingerprint: fingerprint})
    const newStatus = await api.alerts.waitForAlertField(fingerprint, "status", "suppressed")
    expect(newStatus.status).toBe("suppressed")

    // UI: keeping -> still suppressed. Read in place (a fresh feed load lags for
    // a freshly-suppressed alert — see the file header).
    await expectRowStatus(page, row, /suppressed/i)
  })

  test('dismiss alert disposing on new alerts', async({alertsFeed, page, api}) => {
    const { fingerprint } = await api.alerts.sendAlert({name: "dismiss alert - disposing"})
    await api.alerts.waitForAlert(fingerprint)

    // Action via UI: dismiss "forever", "Disposing on new alerts".
    const row = await alertsFeed.loadFeedRow(fingerprint)
    const modal = await row.openDismissModal()
    await modal.setDisposeOnNewAlert(true)
    await modal.comment.fill("disposing dismiss")
    await modal.submit()
    await expect(modal.root).toBeHidden()
    await api.alerts.waitForAlertField(fingerprint, "status", "suppressed")

    // A new alert arrives on the same fingerprint (trigger; no UI equivalent).
    await api.alerts.sendAlert({fingerprint: fingerprint})
    const newStatus = await api.alerts.waitForAlertField(fingerprint, "status", "firing")
    expect(newStatus.status).toBe("firing")

    // UI: disposing -> the suppressed status is disposed and reverts to firing.
    // A firing alert indexes normally, so a fresh feed load surfaces it.
    await alertsFeed.loadFeed(celFingerprint(fingerprint), [fingerprint])
    await expectRowStatus(page, alertsFeed.row(fingerprint), /firing/i)
  })

  test('restore alert', async({alertsFeed, page, api}) => {
    const { fingerprint } = await api.alerts.sendAlert({name: "restore alert test", status: "suppressed"})
    await api.alerts.waitForAlertField(fingerprint, "status", "suppressed")

    // Action via UI: a suppressed alert's row menu shows "Restore" (not
    // "Dismiss"), opening the shared modal in its restore branch. Pick the new
    // status to restore to, add a note, and restore.
    const row = await alertsFeed.loadFeedRow(fingerprint)
    const modal = await row.openRestoreModal()
    await modal.selectStatus("Firing")
    await modal.note.fill("restore note")
    await modal.submit()
    await expect(modal.root).toBeHidden()

    // Backend assert: the dismiss columns are cleared and the status is restored.
    await api.alerts.waitForEnrichment(
      fingerprint,
      (a) => a.status === "firing" && !a.dismiss_mode && !a.dismissed_until,
      30_000,
      "restore → status=firing, dismiss cleared"
    )

    // UI assert: the row shows firing again (a firing alert indexes normally).
    await alertsFeed.loadFeed(celFingerprint(fingerprint), [fingerprint])
    await expectRowStatus(page, alertsFeed.row(fingerprint), /firing/i)
  })
});
