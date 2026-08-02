import { expect, type Locator, type Page } from "@playwright/test";
import { CorrelationSidebar } from "./modals/correlation-sidebar.modal";

/**
 * The correlation-rules LIST page (/rules) — CorrelationTable / CorrelationPlaceholder:
 * a table of rules plus a "Create Correlation" button (empty state shows the
 * placeholder). The create/edit form lives in the sidebar, mapped separately in
 * `./modals/correlation-sidebar.modal.ts` (CorrelationSidebar).
 */
export class CorrelationPage {
  readonly locators: {
    root: Locator;
    createButton: Locator; // in the table header AND the empty-state placeholder
    placeholder: Locator; // empty-state sankey
    table: Locator;
    rows: Locator;
    rowByName: (name: string) => Locator;
    row: (id: string) => Locator;
    cell: (id: string, columnId: string) => Locator;
    header: (columnId: string) => Locator;
    // Per-row delete button (DeleteRuleCell) — revealed on row hover.
    deleteButton: (name: string) => Locator;
  };

  constructor(readonly page: Page) {
    const rowByName = (name: string) =>
      page.locator('[data-cy="rules-row"]').filter({ hasText: name });
    this.locators = {
      root: page.locator('[data-cy="rules-page"]'),
      createButton: page.locator('[data-cy="rules-create-btn"]'),
      placeholder: page.locator('[data-cy="rules-placeholder-sankey"]'),
      table: page.locator('[data-cy="rules-table"]'),
      rows: page.locator('[data-cy="rules-row"]'),
      rowByName,
      row: (id) => page.locator(`[data-cy="rules-row"][data-cy-id="${id}"]`),
      cell: (id, columnId) =>
        page
          .locator(`[data-cy="rules-row"][data-cy-id="${id}"]`)
          .locator(`[data-cy="rules-cell-${columnId}"]`),
      header: (columnId) => page.locator(`[data-cy="rules-header-${columnId}"]`),
      deleteButton: (name) => rowByName(name).locator('[data-cy="rules-delete-btn"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }

  /** Navigate to the correlation-rules page (/rules). */
  async goto(): Promise<void> {
    await this.page.goto("/rules");
  }

  /**
   * Wait for the rules list to finish loading before interacting with it.
   *
   * On mount the page renders the empty-state PLACEHOLDER first: useRules keys SWR
   * on "/rules" only once `api.isReady()`, so until the API client is ready the key
   * is null (isLoading:false, data:[]) and CorrelationPlaceholder shows. When the
   * API becomes ready the rules load and the component swaps to CorrelationTable.
   *
   * Clicking "Create" during the placeholder window opens the PLACEHOLDER's sidebar,
   * which is then unmounted when the table mounts — detaching the form mid-test.
   * Waiting for the table first guarantees we're in the stable table view.
   *
   * Assumes at least one rule already exists (true once any correlation has been
   * created). For a genuinely empty tenant the placeholder is the final state.
   */
  async waitForRulesLoaded(timeout = 30_000): Promise<void> {
    await expect(this.locators.table).toBeVisible({ timeout });
  }

  /** Open the create-correlation sidebar via the "Create Correlation" button. */
  async clickCreate(): Promise<CorrelationSidebar> {
    await this.locators.createButton.click();
    const sidebar = new CorrelationSidebar(this.page);
    await expect(sidebar.root).toBeVisible();
    return sidebar;
  }

  /**
   * Open a correlation rule's edit sidebar by clicking its row (any cell routes to
   * ?id=<rule id>, which opens the sidebar).
   */
  async openCorrelation(name: string): Promise<CorrelationSidebar> {
    await this.locators.rowByName(name).locator('[data-cy="rules-cell-name"]').click();
    const sidebar = new CorrelationSidebar(this.page);
    await expect(sidebar.root).toBeVisible();
    return sidebar;
  }

  /**
   * Delete a correlation rule via its row's delete button (revealed on hover). The
   * button fires a native confirm(), so the CALLER must register a dialog handler
   * (e.g. `page.once("dialog", d => d.accept())`) before invoking this.
   */
  async clickDelete(name: string): Promise<void> {
    const row = this.locators.rowByName(name);
    await row.hover();
    await this.locators.deleteButton(name).click();
  }
}
