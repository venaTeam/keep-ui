import { type Locator, type Page } from "@playwright/test";

/** Self-assign modal (data-cy="alerts-assign-modal"). */
export class AssignModal {
  readonly locators: {
    root: Locator;
    submitButton: Locator;
  };

  constructor(readonly page: Page) {
    const root = page.locator('[data-cy="alerts-assign-modal"]');
    this.locators = {
      root,
      submitButton: root.locator('[data-cy="alerts-assign-submit-btn"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }
  async submit(): Promise<void> {
    await this.locators.submitButton.click();
  }
}
