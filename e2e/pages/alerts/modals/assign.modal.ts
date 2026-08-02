import { expect, type Locator, type Page } from "@playwright/test";

/** Self-assign modal (data-cy="alerts-assign-modal"). */
export class AssignModal {
  readonly locators: {
    root: Locator;
    keepingToggle: Locator;
    disposingToggle: Locator;
    submitButton: Locator;
  };

  constructor(readonly page: Page) {
    const root = page.locator('[data-cy="alerts-assign-modal"]');
    this.locators = {
      root,
      keepingToggle: root.getByRole("button", { name: "Keeping on new alerts" }),
      disposingToggle: root.getByRole("button", { name: "Disposing on new alerts" }),
      submitButton: root.locator('[data-cy="alerts-assign-submit-btn"]'),
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

  /**
   * Choose the dispose-on-new-alert mode. The toggle is ONE button whose label
   * is its current state ("Keeping on new alerts" = false / "Disposing on new
   * alerts" = true) — only that label is in the DOM — and clicking flips it.
   * Idempotent: clicks only when the current state differs from `dispose`.
   */
  async setDisposeOnNewAlert(dispose: boolean): Promise<void> {
    const desired = dispose ? this.locators.disposingToggle : this.locators.keepingToggle;
    const other = dispose ? this.locators.keepingToggle : this.locators.disposingToggle;
    if ((await desired.count()) === 0) {
      await other.click();
    }
    await expect(desired).toBeVisible();
  }

  async submit(): Promise<void> {
    await this.locators.submitButton.click();
  }
}
