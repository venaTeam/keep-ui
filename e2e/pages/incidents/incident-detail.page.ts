import { type Locator, type Page } from "@playwright/test";

/**
 * A single incident's detail tabs (Timeline / Activity).
 *
 * There is no page-level container `data-cy`, so this class anchors on the
 * meaningful tab surfaces (`timeline`, `activityCard`) rather than a generic
 * `root`. Locators are centralized in the `locators` map.
 */
export class IncidentDetailPage {
  readonly locators: {
    timeline: Locator;
    activityCard: Locator;
    activityItems: Locator;
  };

  constructor(
    readonly page: Page,
    readonly id: string
  ) {
    this.locators = {
      timeline: page.locator('[data-cy="incidents-timeline"]'),
      activityCard: page.locator('[data-cy="incidents-activity-card"]'),
      // One item per audit event (data-cy="incidents-activity-item-<id>").
      activityItems: page.locator('[data-cy^="incidents-activity-item-"]'),
    };
  }

  
  get timeline(): Locator {
    return this.locators.timeline;
  }

  get activityCard(): Locator {
    return this.locators.activityCard;
  }

  async gotoTimeline(): Promise<void> {
    await this.page.goto(`/incidents/${this.id}/timeline`);
  }

  async gotoActivity(): Promise<void> {
    await this.page.goto(`/incidents/${this.id}/activity`);
  }
  
  activityItems(): Locator {
    return this.locators.activityItems;
  }
}
