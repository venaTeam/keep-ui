import { test, expect } from "../fixtures/test-base";

/**
 * [check:04] add-note
 *
 * Drives the per-row "Add Note" quick action on the alerts feed:
 *   the note button is a direct row quick-action (no dropdown needed) → the note
 *   modal → type a note into the textarea → save.
 *
 * Hybrid:
 *  - seed via api.alerts.sendAlert
 *  - mutate via the real UI (AlertRow.openNoteModal / NoteModal)
 *  - backend-assert via api.alerts.waitForEnrichment(fp, a => a.note includes text)
 *  - render-assert the note text is visible in the UI.
 */
test.describe("[check:04] add-note", () => {
  test("adding a note via the UI persists and renders", async ({
    alertsFeed,
    api,
  }) => {
    const stamp = Date.now();
    const noteText = `sanity note ${stamp}`;

    // --- seed ---------------------------------------------------------------
    const { fingerprint } = await api.alerts.sendAlert({ name: "sanity-note" });
    await api.alerts.waitForAlert(fingerprint);

    // --- locate the row -----------------------------------------------------
    // The feed only lists alerts once a CEL query is submitted; filter to this fp.
    const row = await alertsFeed.loadFeedRow(fingerprint);
    await expect(row.root).toBeVisible();

    // --- open the note modal via the row quick-action -----------------------
    const modal = await row.openNoteModal();

    // --- type and save ------------------------------------------------------
    await modal.textarea.fill(noteText);
    await modal.save();
    await expect(modal.root).toBeHidden();

    // --- backend assert: the note was enriched ------------------------------
    await api.alerts.waitForEnrichment(
      fingerprint,
      (a) => String(a.note || "").includes(noteText),
      30_000,
      "note enrichment"
    );

    // --- render assert: the note text is visible ----------------------------
    // Re-open the note modal — it prefills the persisted note (useEffect sets
    // noteContent from alert.note) — and assert the text is shown.
    const reopened = await row.openNoteModal();
    await expect(reopened.root.getByText(noteText)).toBeVisible();
  });

  test("deleting a note via the UI clears it from the alert", async ({
    alertsFeed,
    api,
  }) => {
    const stamp = Date.now();
    const noteText = `sanity delete-note ${stamp}`;

    // --- seed: an alert that already carries a note -------------------------
    const { fingerprint } = await api.alerts.sendAlert({
      name: `sanity-delete-note-${stamp}`,
    });
    await api.alerts.waitForAlert(fingerprint);
    await api.alerts.addNote(fingerprint, noteText);
    await api.alerts.waitForEnrichment(
      fingerprint,
      (a) => String(a.note || "").includes(noteText),
      30_000,
      "seeded note present"
    );

    // --- open the note modal: it prefills the persisted note ----------------
    const row = await alertsFeed.loadFeedRow(fingerprint);
    const modal = await row.openNoteModal();
    // The note is the textarea's VALUE (controlled input), not its text content.
    await expect(modal.textarea).toHaveValue(noteText);

    // --- clear + save: an empty note unenriches (removes) it ----------------
    await modal.textarea.clear();
    await modal.save();
    await expect(modal.root).toBeHidden();

    // --- backend assert: the note is gone -----------------------------------
    await api.alerts.waitForEnrichment(
      fingerprint,
      (a) => !a.note,
      30_000,
      "note cleared"
    );

    // --- render assert: reopening shows an empty textarea -------------------
    const reopened = await row.openNoteModal();
    await expect(reopened.textarea).toHaveValue("");
  });
});
