import { expect, type Locator, type Page } from "@playwright/test";
import { celFingerprint } from "../../components/cel";
import { ChangeStatusModal, BulkChangeStatusModal } from "./modals/change-status.modal";
import { DismissModal } from "./modals/dismiss.modal";
import { RestoreModal } from "./modals/restore.modal";
import { NoteModal } from "./modals/note.modal";
import { AssignModal } from "./modals/assign.modal";
import { CreatePresetModal } from "./modals/create-preset.modal";
import { PresetForm } from "./modals/preset-form.modal";
import { AlertDetailSidebar } from "./alert-detail-sidebar";

/**
 * Page objects for the alerts feed (/alerts/feed). This is the most-exercised
 * surface in the suite, so it carries the battle-tested, dev-only defensiveness
 * the raw helpers grew (see loadFeed).
 *
 * The modals reachable from a row / the selection toolbar live under
 * `./modals/*` (one file per modal) — a page file exposes flows and returns the
 * typed modal object, it does not define the modals.
 *
 * Locator convention: every class centralizes its locators in a single
 * `locators` map built in the constructor (static Locators + parameterized
 * locator factories). Methods and public getters reference `this.locators.*` and
 * never build a locator inline — so a data-cy change is a one-line edit in the
 * map, and the flows read as intent.
 *
 * Layout:
 *   AlertsFeedPage  — navigate/apply a CEL filter, table-level chrome (settings
 *                     columns popover, selection actions toolbar).
 *   AlertRow        — one feed row keyed by fingerprint; opens the per-row menu,
 *                     quick actions, and returns typed modal objects.
 */

// --- row --------------------------------------------------------------------

/** One alerts-feed row, keyed by fingerprint. */
export class AlertRow {
  readonly locators: {
    root: Locator;
    cell: (columnId: string) => Locator;
    checkbox: Locator;
    menuButton: Locator;
    menuItem: (slug: string) => Locator;
    noteButton: Locator;
  };

  constructor(
    readonly page: Page,
    readonly fingerprint: string
  ) {
    const root = page.locator(
      `[data-cy="alerts-row"][data-cy-id="${fingerprint}"]`
    );
    this.locators = {
      root,
      cell: (columnId) => root.locator(`[data-cy="alerts-cell-${columnId}"]`),
      checkbox: root.locator(
        '[data-cy="alerts-cell-checkbox"] input[type="checkbox"]'
      ),
      // The ellipsis dropdown trigger inside the row's menu wrapper.
      menuButton: root.locator(
        '[data-cy="alerts-menu"] [data-testid="dropdown-menu-button"]'
      ),
      // Menu items render into a FloatingPortal at the document root, so they
      // are targeted page-wide by their auto-generated data-cy.
      menuItem: (slug) => page.locator(`[data-cy="menu-item-${slug}"]`),
      noteButton: root.locator('[data-cy="alerts-action-note-btn"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }

  /** A cell by its column id, e.g. `cell("status")`, `cell("assignee")`. */
  cell(columnId: string): Locator {
    return this.locators.cell(columnId);
  }

  get checkbox(): Locator {
    return this.locators.checkbox;
  }

  /** Select the row (reveals the AlertActions selection toolbar). */
  async select(): Promise<void> {
    await this.locators.checkbox.check();
  }

  /**
   * Open the row's ellipsis action menu and click one of its items
   * (e.g. "change-status", "dismiss", "self-assign", "restore").
   */
  async openMenuItem(slug: string): Promise<void> {
    await this.locators.menuButton.click();
    await this.locators.menuItem(slug).click();
  }

  async openChangeStatusModal(): Promise<ChangeStatusModal> {
    await this.openMenuItem("change-status");
    const modal = new ChangeStatusModal(this.page);
    // Wait on the single-variant submit button (the root data-cy is shared with
    // the bulk modal, so it alone can't confirm the right variant rendered).
    await expect(modal.submitButton).toBeVisible();
    return modal;
  }

  async openDismissModal(): Promise<DismissModal> {
    await this.openMenuItem("dismiss");
    const modal = new DismissModal(this.page);
    await expect(modal.root).toBeVisible();
    return modal;
  }

  /**
   * Open the restore modal for a SUPPRESSED alert. The row menu shows "Restore"
   * (not "Dismiss") once the alert is suppressed (alert-menu.tsx:520), opening
   * the shared dismiss-modal component in its restore branch. Wait on the
   * restore-variant submit button, since the root data-cy is shared with dismiss.
   */
  async openRestoreModal(): Promise<RestoreModal> {
    await this.openMenuItem("restore");
    const modal = new RestoreModal(this.page);
    await expect(modal.submitButton).toBeVisible();
    return modal;
  }

  async openAssignModal(): Promise<AssignModal> {
    await this.openMenuItem("self-assign");
    const modal = new AssignModal(this.page);
    await expect(modal.root).toBeVisible();
    return modal;
  }

  /**
   * Open the note modal via the row's quick-action tray. The tray is opacity-0
   * until hover, so hover the row first to make the button interactable.
   */
  async openNoteModal(): Promise<NoteModal> {
    await this.locators.root.hover();
    await this.locators.noteButton.click();
    const modal = new NoteModal(this.page);
    await expect(modal.root).toBeVisible();
    return modal;
  }

  /**
   * Open this alert's detail sidebar (the "specific alert" view with its own
   * timeline) by clicking the alert name cell.
   *
   * The rows sit inside a react-selectable-fast drag-to-select wrapper that can
   * swallow a click (it treats some clicks as a select-toggle rather than a row
   * click). In particular a click landing exactly on the `.select-text` name
   * wrapper is eaten — but a click on the name cell reaches the row's
   * open-sidebar handler. It can still miss the very first time, so retry the
   * click until the sidebar actually mounts.
   */
  async openDetailSidebar(): Promise<AlertDetailSidebar> {
    const sidebar = new AlertDetailSidebar(this.page);
    await expect(async () => {
      await this.locators.cell("name").click();
      await expect(sidebar.root).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000, intervals: [500, 1_000, 2_000] });
    return sidebar;
  }
}

// --- page -------------------------------------------------------------------

export class AlertsFeedPage {
  readonly locators: {
    actionsToolbar: Locator;
    selectAllCheckbox: Locator;
    bulkChangeStatusButton: Locator;
    createPresetButton: Locator;
    presetLink: (name: string | RegExp) => Locator;
    groupHeaders: Locator;
    groupHeader: (text: string | RegExp) => Locator;
    columnHeader: (columnId: string) => Locator;
    headerMenuButton: (columnId: string) => Locator;
    groupByMenuItem: Locator;
    // settings popover
    settingsButton: Locator;
    settingsPanel: Locator;
    columnsTab: Locator;
    columnsPanel: Locator;
    columnCheckbox: (columnId: string) => Locator;
    columnsSaveButton: Locator;
    resetToDefaultButton: Locator;
    presetDeleteButton: Locator;
    // feed-loader internals
    celInput: Locator;
    applyHint: Locator;
    appError: Locator;
  };

  constructor(readonly page: Page) {
    this.locators = {
      actionsToolbar: page.locator('[data-cy="alerts-actions"]'),
      // The header "select all" checkbox is a real <input type="checkbox">
      // rendered NESTED inside the checkbox column's sortable header <button>,
      // so the selector must reach the input specifically.
      selectAllCheckbox: page.locator(
        '[data-cy="alerts-header-checkbox"] input[type="checkbox"]'
      ),
      bulkChangeStatusButton: page.locator(
        '[data-cy="alerts-action-change-status-btn"]'
      ),
      createPresetButton: page.locator(
        '[data-cy="alerts-action-create-preset-btn"]'
      ),
      // Sidebar preset links, filtered by their visible name.
      presetLink: (name) =>
        page.locator('[data-cy="preset-link"]').filter({ hasText: name }),
      groupHeaders: page.locator('[data-cy="alerts-group-header"]'),
      groupHeader: (text) =>
        page.locator('[data-cy="alerts-group-header"]').filter({ hasText: text }),
      columnHeader: (columnId) =>
        page.locator(`[data-cy="alerts-header-${columnId}"]`),
      headerMenuButton: (columnId) =>
        page.locator(
          `[data-cy="alerts-header-${columnId}"] [data-testid="dropdown-menu-button"]`
        ),
      groupByMenuItem: page.locator('[data-cy="menu-item-group-by"]'),
      settingsButton: page.locator('[data-cy="settings-button"]'),
      settingsPanel: page.locator('[data-cy="settings-panel"]'),
      columnsTab: page.locator('[data-cy="tab-columns"]'),
      columnsPanel: page.locator('[data-cy="panel-columns"]'),
      columnCheckbox: (columnId) =>
        page.locator(`[data-cy="column-checkbox-${columnId}"]`),
      columnsSaveButton: page.locator('[data-cy="alerts-columns-save-btn"]'),
      resetToDefaultButton: page.locator('[data-cy="reset-to-default-button"]'),
      presetDeleteButton: page.locator('[data-cy="preset-delete-btn"]'),
      celInput: page.locator('[data-cy="cel-input"]'),
      applyHint: page.getByText("Enter to apply", { exact: false }),
      appError: page.getByText("Application error"),
    };
  }

  /** A row handle by fingerprint (no navigation / assertion). */
  row(fingerprint: string): AlertRow {
    return new AlertRow(this.page, fingerprint);
  }

  /** The selection actions toolbar, shown once one or more rows are selected. */
  get actionsToolbar(): Locator {
    return this.locators.actionsToolbar;
  }

  /** The header "select all" checkbox (the checkbox column header). */
  get selectAllCheckbox(): Locator {
    return this.locators.selectAllCheckbox;
  }

  /** A column header cell by column id (data-cy="alerts-header-<id>"). */
  columnHeader(columnId: string): Locator {
    return this.locators.columnHeader(columnId);
  }

  /** Group header rows produced by grouping (data-cy="alerts-group-header"). */
  groupHeaders(): Locator {
    return this.locators.groupHeaders;
  }

  /** A group header filtered by its visible label text. */
  groupHeader(text: string | RegExp): Locator {
    return this.locators.groupHeader(text);
  }

  /**
   * Select every row in the feed via the header "select all" checkbox.
   *
   * Uses `force: true`: the checkbox's ancestor sortable <button> carries
   * `aria-disabled="true"` (sorting is disabled on the checkbox column), which
   * Playwright inherits and reports as "element is not enabled" — a false
   * positive. The input itself is interactive, so we bypass the actionability
   * gate and toggle it directly.
   */
  async selectAll(): Promise<void> {
    await this.locators.selectAllCheckbox.check({ force: true });
  }

  /**
   * Load the feed with `cel` applied and wait until every fingerprint in
   * `expectFingerprints` has a visible row. Re-navigates on each poll attempt so
   * dev-mode param-strips / hydration crashes are retried, not fatal.
   *
   * Why this is defensive — the sanity-check stack runs `npm run dev`, whose
   * three timing-dependent, dev-only behaviours can drop the filter or crash the
   * page (CEL Enter swallowed, Strict-Mode `cel` param strip, hydration crash).
   * Strategy: navigate with the `cel` URL param, reload on a client-side crash,
   * commit via the editor only if still unapplied, then poll for the row(s)
   * RE-NAVIGATING each attempt.
   */
  async loadFeed(cel: string, expectFingerprints: string[] = []): Promise<void> {
    await expect(async () => {
      await this.navigateAndApply(cel);
      for (const fp of expectFingerprints) {
        await expect(this.row(fp).root).toBeVisible({ timeout: 6_000 });
      }
    })
      // A confirmed-present alert can still take a while to surface in the feed
      // index — especially under suite load (teardown hard-deletes churn the
      // index for the next test). This is render latency, not a missing alert
      // (callers waitForAlert first), so give the poll generous headroom.
      .toPass({ timeout: 90_000, intervals: [1_000, 2_000, 3_000, 5_000] });
  }

  /** Load the feed filtered to exactly one alert and return its row. */
  async loadFeedRow(fingerprint: string): Promise<AlertRow> {
    await this.loadFeed(celFingerprint(fingerprint), [fingerprint]);
    return this.row(fingerprint);
  }

  /**
   * Enable a non-default alerts-table column via the settings popover
   * (settings-button → Columns tab → column checkbox → save). Many columns
   * (assignee, application, …) are hidden by default (DEFAULT_COLS), so a render
   * assertion on their cell needs the column turned on first.
   */
  async enableColumn(columnId: string): Promise<void> {
    await this.locators.settingsButton.click();
    await expect(this.locators.settingsPanel).toBeVisible();
    await this.locators.columnsTab.click();
    await expect(this.locators.columnsPanel).toBeVisible();

    const checkbox = this.locators.columnCheckbox(columnId);
    await checkbox.scrollIntoViewIfNeeded();
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }
    await this.locators.columnsSaveButton.click();
  }

  /**
   * Group the feed by a column via its header menu. The menu trigger is the
   * dropdown button inside the header (revealed on hover); the "Group by" item
   * auto-generates data-cy="menu-item-group-by". Only one column can be grouped
   * at a time — call `resetTableSettings()` to clear it.
   */
  async groupByColumn(columnId: string): Promise<void> {
    const header = this.locators.columnHeader(columnId);
    await expect(header).toBeVisible();
    await header.hover();
    await this.locators.headerMenuButton(columnId).click();
    await this.locators.groupByMenuItem.click();
  }

  /**
   * Reset the table to its default columns + grouping via the settings popover's
   * "Reset" button. That button only renders once the view is customized
   * (data-cy="reset-to-default-button"), and its handler ALSO clears grouping —
   * so this is the one-click UI cleanup after a column/grouping test. Because it
   * is gated on being customized, only call it when the test has actually
   * changed the table (e.g. added a column / grouped).
   */
  async resetTableSettings(): Promise<void> {
    await this.locators.settingsButton.click();
    await expect(this.locators.settingsPanel).toBeVisible();
    await this.locators.columnsTab.click();
    await expect(this.locators.columnsPanel).toBeVisible();
    await this.locators.resetToDefaultButton.click();
  }

  /**
   * Open the change-status modal for the CURRENT selection from the actions
   * toolbar. Submitting takes the batch path (POST /alerts/batch_enrich). Select
   * rows first (AlertRow.select / selectAll) so the toolbar is present.
   */
  async openBulkChangeStatusModal(): Promise<BulkChangeStatusModal> {
    await this.locators.bulkChangeStatusButton.click();
    const modal = new BulkChangeStatusModal(this.page);
    // Wait on the bulk-variant submit button (shared root data-cy with single).
    await expect(modal.submitButton).toBeVisible();
    return modal;
  }

  /** Open the create-preset modal from the selection actions toolbar. */
  async openCreatePresetModal(): Promise<CreatePresetModal> {
    await this.locators.createPresetButton.click();
    const modal = new CreatePresetModal(this.page);
    await expect(modal.root).toBeVisible();
    return modal;
  }

  // --- preset page (/alerts/<name>) -----------------------------------------

  /** The CEL editor (Monaco) on the feed / preset page. */
  get celInput(): Locator {
    return this.locators.celInput;
  }

  /** A sidebar preset link, filtered by its visible name. */
  presetLink(name: string | RegExp): Locator {
    return this.locators.presetLink(name);
  }

  /** The "Delete preset" button on a dynamic preset's page. */
  get presetDeleteButton(): Locator {
    return this.locators.presetDeleteButton;
  }

  /**
   * Delete the currently-open preset via its "Delete preset" button. The button
   * fires a native confirm() dialog, so the CALLER must register a dialog handler
   * (e.g. `page.once("dialog", d => d.accept())`) before invoking this. On
   * confirm, the app deletes the preset and navigates to /alerts/feed.
   */
  async deletePreset(): Promise<void> {
    await this.locators.presetDeleteButton.click();
  }

  /** Navigate to a saved preset's page (/alerts/<name>). */
  async gotoPreset(name: string): Promise<void> {
    await this.page.goto(`/alerts/${encodeURIComponent(name)}`);
  }

  /**
   * Replace the CEL in the preset page's CEL field. Typing updates the builder's
   * live CEL state (onValueChange), which the toolbar "Edit preset" button then
   * captures into the preset form — so no Enter/apply is needed here.
   */
  async setCel(cel: string): Promise<void> {
    // Clicking the [data-cy="cel-input"] wrapper doesn't focus Monaco — click the
    // Monaco editor itself. Insert the whole string at once: per-key typing drops
    // characters and triggers auto-close, whereas insertText is atomic and exact.
    await this.locators.celInput.locator(".monaco-editor").first().click();
    await this.page.keyboard.press("ControlOrMeta+A");
    await this.page.keyboard.press("Backspace");
    await this.page.keyboard.insertText(cel);
  }

  /**
   * Open the edit-preset modal via the toolbar "Edit preset" button. That button
   * captures the current CEL into the form. Its data-cy is shared with the form's
   * Save button, but only the toolbar one exists while the modal is closed.
   */
  async openEditPresetForm(): Promise<PresetForm> {
    await this.page.locator('[data-cy="save-preset-button"]').click();
    const form = new PresetForm(this.page);
    await expect(form.root).toBeVisible();
    return form;
  }

  // --- internals ------------------------------------------------------------

  /** One navigate + apply attempt (no row assertions). */
  private async navigateAndApply(cel: string): Promise<void> {
    await this.page.goto(`/alerts/feed?cel=${encodeURIComponent(cel)}`, {
      waitUntil: "domcontentloaded",
    });

    // Recover from an intermittent dev-mode client-side crash.
    if (await this.locators.appError.count().catch(() => 0)) {
      await this.page.reload({ waitUntil: "domcontentloaded" });
    }

    // Wait for the CEL editor to mount.
    await this.locators.celInput
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});

    // If the URL pre-fill applied, the "Enter to apply" hint is absent and we're
    // done. Otherwise commit explicitly: retype from a clean slate (the param may
    // have been stripped) and press Enter, dismissing any autocomplete first.
    if (await this.locators.applyHint.count().catch(() => 0)) {
      await this.locators.celInput.click().catch(() => {});
      await this.page.keyboard.press("ControlOrMeta+A").catch(() => {});
      await this.page.keyboard.press("Backspace").catch(() => {});
      await this.page.keyboard.type(cel, { delay: 15 }).catch(() => {});
      await this.page.keyboard.press("Escape").catch(() => {}); // close autocomplete
      await this.page.keyboard.press("Enter").catch(() => {});
    }
  }
}
