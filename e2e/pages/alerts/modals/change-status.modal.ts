import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Change-status modals for the alerts feed.
 *
 * The single-alert and bulk flows are rendered by ONE component
 * (alert-change-status-modal.tsx) as two branches that share the same root
 * `data-cy="alerts-change-status-modal"` and the same status picker / dispose
 * toggle / note field, but expose DIFFERENT submit & cancel buttons. Subclasses
 * pass those button selectors into the map.
 *
 * Locator convention (whole suite): every class centralizes its locators in a
 * single `locators` map built in the constructor; methods and getters reference
 * `this.locators.*` and never build a locator inline.
 */
class BaseChangeStatusModal {
  readonly locators: {
    root: Locator;
    keepingToggle: Locator;
    disposingToggle: Locator;
    note: Locator;
    combobox: Locator;
    option: (name: string) => Locator;
    submitButton: Locator;
    cancelButton: Locator;
  };

  constructor(
    readonly page: Page,
    buttons: { submit: string; cancel: string }
  ) {
    const root = page.locator('[data-cy="alerts-change-status-modal"]');
    this.locators = {
      root,
      keepingToggle: root.getByRole("button", { name: "Keeping on new alerts" }),
      disposingToggle: root.getByRole("button", { name: "Disposing on new alerts" }),
      note: root.locator("textarea"),
      combobox: root.getByRole("combobox"),
      option: (name) => page.getByRole("option", { name }),
      submitButton: root.locator(buttons.submit),
      cancelButton: root.locator(buttons.cancel),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }
  /** The dispose-on-new-alert toggle labels ARE the state contract. */
  get keepingToggle(): Locator {
    return this.locators.keepingToggle;
  }
  get disposingToggle(): Locator {
    return this.locators.disposingToggle;
  }
  /** Optional note textarea shared by both variants. */
  get note(): Locator {
    return this.locators.note;
  }
  /** The variant's submit button — its presence also distinguishes the variant. */
  get submitButton(): Locator {
    return this.locators.submitButton;
  }
  get cancelButton(): Locator {
    return this.locators.cancelButton;
  }

  /** Pick a status from the react-select combobox (portal-rendered options). */
  async selectStatus(status: string): Promise<void> {
    await this.locators.combobox.click();
    await this.locators.combobox.fill(status);
    await this.locators.option(status).click();
  }

  async submit(): Promise<void> {
    await this.locators.submitButton.click();
  }
  async cancel(): Promise<void> {
    await this.locators.cancelButton.click();
  }
}

/**
 * Single-alert change-status modal (per-row menu flow). Submitting takes the
 * single-alert path: POST /alerts/enrich.
 */
export class ChangeStatusModal extends BaseChangeStatusModal {
  constructor(page: Page) {
    super(page, {
      submit: '[data-cy="alerts-change-status-submit-btn"]',
      cancel: '[data-cy="alerts-change-status-cancel-btn"]',
    });
  }
}

/**
 * Bulk change-status modal (selection actions-toolbar flow). Same component and
 * root `data-cy` as the single modal, but distinct `…-batch-…` buttons.
 * Submitting takes the batch path: POST /alerts/batch_enrich.
 */
export class BulkChangeStatusModal extends BaseChangeStatusModal {
  constructor(page: Page) {
    super(page, {
      submit: '[data-cy="alerts-change-status-batch-submit-btn"]',
      cancel: '[data-cy="alerts-change-status-batch-cancel-btn"]',
    });
  }
}
