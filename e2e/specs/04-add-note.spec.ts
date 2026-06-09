import { test, expect } from "../fixtures/test-base";
import { loadFeedRow } from "../fixtures/ui";

/**
 * [check:04] add-note
 *
 * Drives the per-row "Add Note" quick action on the alerts feed:
 *   the note button is a direct row quick-action (data-cy="alerts-action-note-btn",
 *   no dropdown needed) → the note modal (data-cy="alerts-note-modal") → type a
 *   note into the textarea → save (data-cy="alerts-note-save-btn").
 *
 * Hybrid:
 *  - seed via api.sendAlert
 *  - mutate via the real UI
 *  - backend-assert via api.waitForEnrichment(fp, a => a.note includes text)
 *  - render-assert the note text is visible in the UI.
 */
test.describe("[check:04] add-note", () => {
  test("adding a note via the UI persists and renders", async ({ page, api }) => {
    const stamp = Date.now();
    const noteText = `sanity note ${stamp}`;

    // --- seed ---------------------------------------------------------------
    const { fingerprint } = await api.sendAlert({ name: "sanity-note" });
    await api.waitForAlert(fingerprint);

    // --- locate the row -----------------------------------------------------
    // The feed only lists alerts once a CEL query is submitted; filter to this fp.
    const row = await loadFeedRow(page, fingerprint);
    await expect(row).toBeVisible();

    // --- open the note modal via the row quick-action -----------------------
    // The quick-action tray is opacity-0 until hover; hover the row first so
    // the note button becomes interactable, then click it.
    await row.hover();
    await row.locator('[data-cy="alerts-action-note-btn"]').click();

    const modal = page.locator('[data-cy="alerts-note-modal"]');
    await expect(modal).toBeVisible();

    // --- type and save ------------------------------------------------------
    await modal.locator("textarea").fill(noteText);
    await modal.locator('[data-cy="alerts-note-save-btn"]').click();
    await expect(modal).toBeHidden();

    // --- backend assert: the note was enriched ------------------------------
    await api.waitForEnrichment(
      fingerprint,
      (a) => String(a.note || "").includes(noteText),
      30_000,
      "note enrichment"
    );

    // --- render assert: the note text is visible ----------------------------
    // Re-open the note modal — it prefills the persisted note (useEffect sets
    // noteContent from alert.note) — and assert the text is shown.
    await row.hover();
    await row.locator('[data-cy="alerts-action-note-btn"]').click();
    const reopened = page.locator('[data-cy="alerts-note-modal"]');
    await expect(reopened).toBeVisible();
    await expect(reopened.getByText(noteText)).toBeVisible();
  });
});
