import { type Locator, type Page } from "@playwright/test";

/**
 * The per-alert detail sidebar (data-cy="alerts-sidebar"), opened by clicking a
 * feed row. This is the "specific alert" surface: it renders the alert's OWN
 * timeline (data-cy="alerts-timeline", fed by GET /alerts/<fp>/audit) — the UI
 * counterpart to that alert's audit history.
 *
 * Not a CRUD modal, so it lives beside the alerts page rather than under
 * `modals/`. Locators are centralized in the `locators` map.
 */
export class AlertDetailSidebar {
  readonly locators: {
    root: Locator;
    timeline: Locator;
    refreshButton: Locator;
    closeButton: Locator;
  };

  constructor(readonly page: Page) {
    const root = page.locator('[data-cy="alerts-sidebar"]');
    this.locators = {
      root,
      timeline: root.locator('[data-cy="alerts-timeline"]'),
      refreshButton: root.locator('[data-cy="alerts-timeline-refresh-btn"]'),
      closeButton: root.locator('[data-cy="alerts-sidebar-close-btn"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }
  /** The alert's own timeline (audit trail) rendered inside the sidebar. */
  get timeline(): Locator {
    return this.locators.timeline;
  }

  async refresh(): Promise<void> {
    await this.locators.refreshButton.click();
  }
  async close(): Promise<void> {
    await this.locators.closeButton.click();
  }
}
