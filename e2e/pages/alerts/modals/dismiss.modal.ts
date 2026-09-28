import { type Locator, type Page } from "@playwright/test";

/** Dismiss modal (data-cy="alerts-dismiss-modal") — permanent + dismiss-until. */
export class DismissModal {
  readonly locators: {
    root: Locator;
    keepingToggle: Locator;
    disposingToggle: Locator;
    comment: Locator;
    untilTab: Locator;
    submitButton: Locator;
    cancelButton: Locator;
  };

  constructor(readonly page: Page) {
    const root = page.locator('[data-cy="alerts-dismiss-modal"]');
    this.locators = {
      root,
      keepingToggle: root.getByRole("button", { name: "Keeping on new alerts" }),
      disposingToggle: root.getByRole("button", { name: "Disposing on new alerts" }),
      comment: root.locator("textarea"),
      untilTab: root.getByRole("tab", { name: "Dismiss Until" }),
      submitButton: root.locator('[data-cy="alerts-dismiss-submit-btn"]'),
      cancelButton: root.locator('[data-cy="alerts-dismiss-cancel-btn"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }
  get keepingToggle(): Locator {
    return this.locators.keepingToggle;
  }
  get disposingToggle(): Locator {
    return this.locators.disposingToggle;
  }

  get comment(): Locator {
    return this.locators.comment;
  }


  async selectUntilTab(): Promise<void> {
    await this.locators.untilTab.click();
  }
  async submit(): Promise<void> {
    await this.locators.submitButton.click();
  }
  async cancel(): Promise<void> {
    await this.locators.cancelButton.click();
  }
}
