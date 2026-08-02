import { expect, type Locator, type Page } from "@playwright/test";
import { IncidentForm } from "./modals/incident-form.modal";
import { IncidentDetailPage } from "./incident-detail.page";

/**
 * The /incidents list page (create button, table, facets panel).
 *
 * `openCreateForm()` returns the IncidentForm modal (defined under `./modals`),
 * and `detail(id)` returns the IncidentDetailPage — neither modal nor detail is
 * defined in this file.
 *
 * The incidents table has a HARD-CODED column set and ships no group-by control;
 * the only field-grouping surface is the server-side Facets panel, so grouping
 * assertions go through `facetsPanel` / `facetValues()`.
 *
 * There is no page-level container `data-cy`, so this class anchors on `table`
 * rather than a generic `root`. Locators are centralized in the `locators` map.
 */
export class IncidentsPage {
  readonly locators: {
    table: Locator;
    rows: Locator;
    rowsByName: (name: string) => Locator;
    rowById: (id: string) => Locator;
    createButton: Locator;
    facetsPanel: Locator;
    facetValues: Locator;
    facetValueCounts: Locator;
  };

  constructor(readonly page: Page) {
    const facetsPanel = page.locator('[data-cy="facets-panel"]');
    this.locators = {
      table: page.locator('[data-cy="incidents-table"]'),
      rows: page.locator('[data-cy="incidents-row"]'),
      rowsByName: (name) =>
        page.locator('[data-cy="incidents-row"]', { hasText: name }),
      rowById: (id) =>
        page.locator(`[data-cy="incidents-row"][data-cy-id="${id}"]`),
      createButton: page.locator('[data-cy="incidents-action-create-btn"]'),
      facetsPanel,
      facetValues: facetsPanel.locator('[data-cy="facet-value"]'),
      facetValueCounts: facetsPanel.locator('[data-cy="facet-value-count"]'),
    };
  }

  async goto(): Promise<void> {
    await this.page.goto("/incidents");
  }

  get table(): Locator {
    return this.locators.table;
  }

  /** All incident rows, or only those matching `name` when provided. */
  rows(name?: string): Locator {
    return name ? this.locators.rowsByName(name) : this.locators.rows;
  }

  /**
   * Navigate to the list and wait until the table shows a row matching `name`,
   * RE-NAVIGATING each attempt. In the dev stack a (re)load intermittently
   * throws a client-side exception ("Application error"), leaving the table
   * unmounted; a fresh navigation each attempt recovers from that crash and also
   * picks up a freshly created row. Prefer this over a bare `page.reload()`.
   */
  async gotoAndExpectRow(name: string): Promise<void> {
    await expect(async () => {
      await this.goto();
      // Wait patiently on each attempt: the list shows a "getting your data"
      // placeholder while /incidents loads, and re-navigating before it settles
      // restarts the fetch (thrash) so the table never renders. Keep the per-
      // attempt table wait generous enough for the initial fetch to complete.
      await expect(this.table).toBeVisible({ timeout: 25_000 });
      await expect(this.rows(name)).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 120_000, intervals: [2_000, 5_000] });
  }

  /**
   * Like `gotoAndExpectRow` but matches the row by incident id (data-cy-id) rather
   * than name — rule-generated incidents often have no stable display name, so id
   * is the reliable key. Re-navigates each attempt to recover from the dev stack's
   * intermittent client-side crash and to pick up the freshly created row.
   */
  async gotoAndExpectRowById(id: string): Promise<void> {
    await expect(async () => {
      await this.goto();
      await expect(this.table).toBeVisible({ timeout: 25_000 });
      await expect(this.locators.rowById(id)).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 120_000, intervals: [2_000, 5_000] });
  }

  /**
   * Open an incident's detail page by clicking its name link in the row (the name
   * cell is a <Link href="/incidents/<id>/alerts">). Returns the detail page built
   * from the id parsed out of the resulting URL. Call `gotoAndExpectRow(name)` first
   * so the row is present.
   */
  async openIncident(name: string): Promise<IncidentDetailPage> {
    await this.locators.rowsByName(name).getByRole("link", { name }).first().click();
    await this.page.waitForURL(/\/incidents\/[^/?#]+/, { timeout: 30_000 });
    const id = this.page.url().match(/\/incidents\/([^/?#]+)/)?.[1];
    if (!id) {
      throw new Error(`could not parse incident id from URL: ${this.page.url()}`);
    }
    return new IncidentDetailPage(this.page, id);
  }

  /**
   * Open the create-incident modal. The list exposes a create button both in the
   * header and the empty-state placeholder; either opens the same modal.
   */
  async openCreateForm(): Promise<IncidentForm> {
    await this.locators.createButton.first().click();
    const form = new IncidentForm(this.page);
    await expect(form.root).toBeVisible();
    return form;
  }

  /**
   * Open the edit form for a specific incident via its row action menu
   * (ellipsis → "Edit"). Rows are keyed by `data-cy-id={incident.id}`; the menu
   * items render into a portal, so the "Edit" item is targeted page-wide. Loads
   * the same modal component as create, in edit mode (submit reads "Update").
   */
  async openEditForm(id: string): Promise<IncidentForm> {
    const row = this.page.locator(
      `[data-cy="incidents-row"][data-cy-id="${id}"]`
    );
    await expect(row).toBeVisible();
    const menuButton = row.locator('[data-cy="incidents-row-menu-btn"]');
    const editItem = this.page.locator('[data-cy="incidents-row-menu-edit"]');
    // The dropdown opens on mousedown (floating-ui useClick) and its items render
    // into a portal; retry the open until the Edit item actually appears, then
    // click it. This tolerates a click that lands before the menu is interactive.
    await expect(async () => {
      await menuButton.click();
      await expect(editItem).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000, intervals: [500, 1_000] });
    await editItem.click();
    const form = new IncidentForm(this.page);
    await expect(form.root).toBeVisible();
    return form;
  }

  /**
   * Delete an incident via its row action menu (ellipsis → "Delete"). The delete
   * handler fires a native confirm() dialog, so the CALLER must register a dialog
   * handler (e.g. `page.once("dialog", d => d.accept())`) before invoking this.
   */
  async deleteFromRow(id: string): Promise<void> {
    const row = this.page.locator(
      `[data-cy="incidents-row"][data-cy-id="${id}"]`
    );
    await expect(row).toBeVisible();
    const menuButton = row.locator('[data-cy="incidents-row-menu-btn"]');
    const deleteItem = this.page.locator('[data-cy="incidents-row-menu-delete"]');
    await expect(async () => {
      await menuButton.click();
      await expect(deleteItem).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000, intervals: [500, 1_000] });
    await deleteItem.click();
  }

  // --- facets (the group-by surface) ----------------------------------------
  get facetsPanel(): Locator {
    return this.locators.facetsPanel;
  }
  /** Grouped value rows within the facets panel (each carries a count). */
  facetValues(): Locator {
    return this.locators.facetValues;
  }
  facetValueCounts(): Locator {
    return this.locators.facetValueCounts;
  }

  detail(id: string): IncidentDetailPage {
    return new IncidentDetailPage(this.page, id);
  }
}
