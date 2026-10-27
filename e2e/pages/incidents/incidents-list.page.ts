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
      await expect(this.table).toBeVisible({ timeout: 6_000 });
      await expect(this.rows(name)).toBeVisible({ timeout: 6_000 });
    }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 3_000, 5_000] });
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
