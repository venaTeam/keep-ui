import { type Locator, type Page } from "@playwright/test";

/**
 * Create-preset modal (data-cy="alerts-create-preset-modal"). Its name input and
 * submit button render at page level (not scoped inside the modal element), so
 * they are mapped off the page.
 */
export class CreatePresetModal {
  readonly locators: {
    root: Locator;
    nameInput: Locator;
    submitButton: Locator;
  };

  constructor(readonly page: Page) {
    this.locators = {
      root: page.locator('[data-cy="alerts-create-preset-modal"]'),
      nameInput: page.locator('[data-cy="alerts-create-preset-name-input"]'),
      submitButton: page.locator('[data-cy="alerts-create-preset-submit-btn"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }
  async fillName(name: string): Promise<void> {
    await this.locators.nameInput.fill(name);
  }
  async submit(): Promise<void> {
    await this.locators.submitButton.click();
  }
}
