import { type Locator, type Page } from "@playwright/test";

export class NoteModal {
  readonly locators: {
    root: Locator;
    textarea: Locator;
    saveButton: Locator;
  };

  constructor(readonly page: Page) {
    const root = page.locator('[data-cy="alerts-note-modal"]');
    this.locators = {
      root,
      textarea: root.locator("textarea"),
      saveButton: root.locator('[data-cy="alerts-note-save-btn"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }
  get textarea(): Locator {
    return this.locators.textarea;
  }
  async save(): Promise<void> {
    await this.locators.saveButton.click();
  }
}
