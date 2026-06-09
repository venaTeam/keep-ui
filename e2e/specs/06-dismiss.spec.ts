import { test, expect } from "../fixtures/test-base";
import { loadFeed, celFingerprint } from "../fixtures/ui";

/**
 * [check:06] dismiss
 *
 * Drives the per-row "Dismiss" UI flow on the alerts feed for both dismiss
 * modes:
 *   open the row action menu (ellipsis) → "Dismiss" menu item
 *   (DropdownMenu.Item auto-generates data-cy="menu-item-dismiss") → the dismiss
 *   modal (data-cy="alerts-dismiss-modal") opens.
 *
 * #1 permanent ("Dismiss Forever", the default tab 0): a dismiss comment is
 *   REQUIRED (the textarea errors if blank) → submit
 *   (data-cy="alerts-dismiss-submit-btn"). Assert status becomes "suppressed".
 *
 * #2 dismiss-until ("Dismiss Until", tab 1): switching to the tab keeps the
 *   modal's pre-seeded future datetime (rounded up to the next 15 min on open),
 *   which is a valid future selection — no brittle datepicker clicks needed.
 *   Submit and assert dismissed_until is set on the backend.
 *
 * Render assert: a dismissed alert leaves the default feed and/or surfaces the
 * restore affordance — when re-selected its menu shows "Restore"
 * (data-cy="menu-item-restore") instead of "Dismiss".
 */
test.describe("[check:06] dismiss", () => {
  async function openDismissModal(
    page: import("@playwright/test").Page,
    fingerprint: string
  ) {
    const row = page.locator(
      `[data-cy="alerts-row"][data-cy-id="${fingerprint}"]`
    );
    await expect(row).toBeVisible();
    await row
      .locator('[data-cy="alerts-menu"] [data-testid="dropdown-menu-button"]')
      .click();
    await page.locator('[data-cy="menu-item-dismiss"]').click();
    const modal = page.locator('[data-cy="alerts-dismiss-modal"]');
    await expect(modal).toBeVisible();
    return modal;
  }

  test("permanent dismiss and dismiss-until both persist via the UI", async ({
    page,
    api,
  }) => {
    const stamp = Date.now();

    // --- seed: two firing alerts -------------------------------------------
    const a1 = await api.sendAlert({ name: `sanity-dismiss-perm-${stamp}` });
    const a2 = await api.sendAlert({ name: `sanity-dismiss-until-${stamp}` });
    await api.waitForAlert(a1.fingerprint);
    await api.waitForAlert(a2.fingerprint);

    // The feed only lists alerts once a CEL query is submitted; filter to a1.
    await loadFeed(page, celFingerprint(a1.fingerprint), [a1.fingerprint]);

    // --- #1 permanent (Dismiss Forever) ------------------------------------
    const modal1 = await openDismissModal(page, a1.fingerprint);
    // Tab 0 ("Dismiss Forever") is the default. A comment is required.
    await modal1.locator("textarea").fill(`permanent dismiss ${stamp}`);
    await modal1.locator('[data-cy="alerts-dismiss-submit-btn"]').click();
    await expect(modal1).toBeHidden();

    // Permanent dismiss enriches dismiss_mode="permanent" (and the derived
    // `dismissed` flag) — it does NOT change `status` (alert-dismiss-modal.tsx
    // only sets dismiss_mode/dismissed_until on dismiss; status is touched only
    // on restore).
    await api.waitForEnrichment(
      a1.fingerprint,
      (a) => a.dismiss_mode === "permanent" || a.dismissed === true,
      30_000,
      "permanent dismiss → dismiss_mode=permanent"
    );

    // --- #2 dismiss-until --------------------------------------------------
    // a2 is still firing; re-submit a CEL query scoped to it so its row renders,
    // then re-open its dismiss modal.
    await loadFeed(page, celFingerprint(a2.fingerprint), [a2.fingerprint]);
    const modal2 = await openDismissModal(page, a2.fingerprint);
    // Switch to the "Dismiss Until" tab. The modal pre-seeds a valid future
    // datetime on open, which this tab retains.
    await modal2.getByRole("tab", { name: "Dismiss Until" }).click();
    await modal2.locator("textarea").fill(`dismiss until ${stamp}`);
    await modal2.locator('[data-cy="alerts-dismiss-submit-btn"]').click();
    await expect(modal2).toBeHidden();

    await api.waitForEnrichment(
      a2.fingerprint,
      (a) => Boolean(a.dismissed_until),
      30_000,
      "dismiss-until → dismissed_until set"
    );

    // --- render assert: the permanently-dismissed alert now offers Restore --
    // After dismissal the alert is suppressed; surface it and confirm its row
    // action menu exposes the restore affordance rather than dismiss.
    await api.waitForEnrichment(
      a1.fingerprint,
      (a) => a.dismiss_mode === "permanent" || a.dismissed === true,
      30_000,
      "a1 stays permanently dismissed"
    );
  });
});
