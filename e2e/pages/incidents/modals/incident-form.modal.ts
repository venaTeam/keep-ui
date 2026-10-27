import { type Locator, type Page } from "@playwright/test";

/**
 * The create-incident modal form (data-cy="incidents-form") — name + ReactQuill
 * summary. Lives in its own file (not the incidents page) so the page object
 * stays about the list surface; the page's `openCreateForm()` returns this.
 *
 * Locator convention: all locators centralized in the `locators` map; methods
 * reference `this.locators.*` and never build a locator inline.
 */
export class IncidentForm {
  readonly locators: {
    root: Locator;
    nameInput: Locator;
    summaryEditor: Locator;
    submitButton: Locator;
  };

  constructor(readonly page: Page) {
    const root = page.locator('[data-cy="incidents-form"]');
    this.locators = {
      root,
      nameInput: root.locator('[data-cy="incidents-form-name-input"]'),
      summaryEditor: root.locator(".ql-editor").first(),
      submitButton: root.locator('[data-cy="incidents-form-submit-btn"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }

  async fillName(name: string): Promise<void> {
    await this.locators.nameInput.fill(name);
  }

  /**
   * Fill the summary. The `.ql-editor` is dynamically imported (ssr:false) and
   * compiles lazily in dev, so wait for it to mount before typing.
   */
  async fillSummary(summary: string): Promise<void> {
    const editor = this.locators.summaryEditor;
    await editor.waitFor({ state: "visible", timeout: 45_000 });
    await editor.click();
    await editor.fill(summary);
  }

  async submit(): Promise<void> {
    await this.locators.submitButton.click();
  }
}
