import { expect, type Locator, type Page } from "@playwright/test";
import { DeduplicationSidebar } from "./modals/deduplication-sidebar.modal";

/**
 * The deduplication-rules LIST page (/deduplication) — DeduplicationTable /
 * DeduplicationPlaceholder: a table of rules plus a "Create Deduplication Rule"
 * button. The create/edit form lives in a sidebar mapped SEPARATELY under
 * `./modals/deduplication-sidebar.modal.ts` (DeduplicationSidebar) — this file
 * covers ONLY the list surface.
 *
 * Notes mirrored from the source (DeduplicationTable.tsx / client.tsx):
 *  - Only the TABLE view carries data-cy="dedup-page"; the empty-state
 *    DeduplicationPlaceholder has NO data-cy and NO create button (create is only
 *    reachable once at least one rule exists). client.tsx renders Loading while
 *    fetching, then the placeholder (0 rules) or the table.
 *  - Rows have no dedicated name cell — the visible label is the Description
 *    column (data-cy="dedup-cell-description"), which falls back to
 *    "<provider> deduplication rule" when the rule has no description. Rows are
 *    keyed by data-cy-id={rule.id}; clicking a row opens its edit sidebar (?id=).
 *  - Cell column ids: provider_type | description | ingested | dedup_ratio |
 *    distribution | fingerprint_fields | actions.
 *  - The per-row delete button is revealed on row hover and is DISABLED for
 *    default and provisioned rules (Keep's built-in default rule can't be deleted).
 */
export class DeduplicationPage {
  readonly locators: {
    root: Locator; // dedup-page (table view only)
    createButton: Locator; // dedup-create-btn (table header only)
    placeholder: Locator; // empty-state card (no data-cy → matched by heading)
    table: Locator; // dedup-table
    rows: Locator; // all dedup-row
    rowById: (id: string) => Locator;
    rowByText: (text: string) => Locator; // match a row by its (description) text
    cell: (id: string, columnId: string) => Locator;
    // Per-row delete button (revealed on row hover; disabled for default/provisioned).
    deleteButton: (id: string) => Locator;
  };

  constructor(readonly page: Page) {
    const rowById = (id: string) =>
      page.locator(`[data-cy="dedup-row"][data-cy-id="${id}"]`);
    this.locators = {
      root: page.locator('[data-cy="dedup-page"]'),
      createButton: page.locator('[data-cy="dedup-create-btn"]'),
      placeholder: page.getByText("No Deduplications Yet"),
      table: page.locator('[data-cy="dedup-table"]'),
      rows: page.locator('[data-cy="dedup-row"]'),
      rowById,
      rowByText: (text) =>
        page.locator('[data-cy="dedup-row"]').filter({ hasText: text }),
      cell: (id, columnId) =>
        rowById(id).locator(`[data-cy="dedup-cell-${columnId}"]`),
      deleteButton: (id) =>
        rowById(id).locator('[data-cy="dedup-action-delete-btn"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }

  /** Navigate to the deduplication-rules page (/deduplication). */
  async goto(): Promise<void> {
    await this.page.goto("/deduplication");
  }

  /**
   * Wait for the rules table to render before interacting. On a cold load the page
   * shows a loading spinner and then either the placeholder (no rules) or the
   * table; waiting for the table avoids acting during that transition. Keep sees
   * built-in default rules once alerts exist, so the table is the usual end state.
   */
  async waitForRulesLoaded(timeout = 30_000): Promise<void> {
    await expect(this.locators.table).toBeVisible({ timeout });
  }

  /**
   * Open the create-deduplication sidebar via the "Create Deduplication Rule"
   * button, returning the sidebar modal (mapped in its own file,
   * ./modals/deduplication-sidebar.modal.ts).
   */
  async clickCreate(): Promise<DeduplicationSidebar> {
    await this.locators.createButton.click();
    const sidebar = new DeduplicationSidebar(this.page);
    await expect(sidebar.root).toBeVisible();
    return sidebar;
  }

  /**
   * Open a rule's edit sidebar by clicking its row (routes to ?id=<rule id>),
   * returning the sidebar modal.
   */
  async openRule(id: string): Promise<DeduplicationSidebar> {
    await this.locators.rowById(id).click();
    const sidebar = new DeduplicationSidebar(this.page);
    await expect(sidebar.root).toBeVisible();
    return sidebar;
  }

  /**
   * Delete a rule via its row delete button (revealed on hover). The button fires
   * a native confirm(), so the CALLER must register a dialog handler (e.g.
   * `page.once("dialog", d => d.accept())`) before invoking this. No-op visually
   * for default/provisioned rules, whose button is disabled.
   */
  async clickDelete(id: string): Promise<void> {
    const row = this.locators.rowById(id);
    await row.hover();
    await this.locators.deleteButton(id).click();
  }
}
