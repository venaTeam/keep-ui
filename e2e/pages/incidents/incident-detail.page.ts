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
    statusSelect: Locator;
    timeline: Locator;
    activityCard: Locator;
    activityItems: Locator;
    alertsTab: Locator;
    alertsTableBody: Locator;
    alertRow: (fingerprint: string) => Locator;
  };

  constructor(
    readonly page: Page,
    readonly id: string
  ) {
    this.locators = {
      // The status control on the overview header renders capitalize(status),
      // e.g. "Resolved" (data-cy="incidents-status-select" data-cy-id=<id>).
      statusSelect: page.locator(
        `[data-cy="incidents-status-select"][data-cy-id="${id}"]`
      ),
      timeline: page.locator('[data-cy="incidents-timeline"]'),
      activityCard: page.locator('[data-cy="incidents-activity-card"]'),
      // One item per audit event (data-cy="incidents-activity-item-<id>").
      activityItems: page.locator('[data-cy^="incidents-activity-item-"]'),
      // The "Alerts" tab link (data-cy="incidents-tab-alerts"), route /alerts.
      alertsTab: page.locator('[data-cy="incidents-tab-alerts"]'),
      // The alerts-tab table body + its rows. The incident's alerts render via the
      // shared AlertsTableBody (presetName "incident-alerts"), so each row carries
      // data-cy="alerts-row" and is keyed by the alert's fingerprint (data-cy-id).
      alertsTableBody: page.locator('[data-cy="alerts-table-body"]'),
      alertRow: (fingerprint) =>
        page.locator(`[data-cy="alerts-row"][data-cy-id="${fingerprint}"]`),
    };
  }

  /** Navigate to the incident's overview (detail) page. */
  async goto(): Promise<void> {
    await this.page.goto(`/incidents/${this.id}`);
  }

  /** The status control on the overview header (shows the current status text). */
  get statusSelect(): Locator {
    return this.locators.statusSelect;
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

  // --- alerts tab -----------------------------------------------------------

  /** Navigate to the incident's associated-alerts view (/incidents/<id>/alerts). */
  async gotoAlerts(): Promise<void> {
    await this.page.goto(`/incidents/${this.id}/alerts`);
  }

  get alertsTableBody(): Locator {
    return this.locators.alertsTableBody;
  }

  /** The alerts-table row for a given alert fingerprint (present iff associated). */
  alertRow(fingerprint: string): Locator {
    return this.locators.alertRow(fingerprint);
  }
}
