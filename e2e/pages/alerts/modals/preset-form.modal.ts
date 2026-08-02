import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The create/update preset form (data-cy="preset-form"), rendered inside the
 * preset modal (data-cy="preset-form-modal"). The SAME component backs create
 * and edit; in edit mode it is pre-filled and its submit button reads "Save".
 *
 * The CEL is NOT edited here — it is carried in from the preset page's CEL field
 * (the toolbar "Edit preset" button captures the current CEL into the form), so
 * this object only exposes name / noisy / tags / save.
 *
 * NOTE: the form's Save button shares data-cy="save-preset-button" with the
 * page toolbar's "Edit preset" button, so `saveButton` is scoped to the form.
 */
export class PresetForm {
  readonly locators: {
    root: Locator;
    nameInput: Locator;
    noisySwitch: Locator;
    tagsSelect: Locator;
    saveButton: Locator;
  };

  constructor(readonly page: Page) {
    const root = page.locator('[data-cy="preset-form"]');
    this.locators = {
      root,
      nameInput: root.locator('[data-cy="preset-name-input"]'),
      noisySwitch: root.locator('[data-cy="is-noisy-switch"]'),
      // The tags CreatableMultiSelect is the only react-select in the form.
      tagsSelect: root.getByRole("combobox"),
      saveButton: root.locator('[data-cy="save-preset-button"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }

  async fillName(name: string): Promise<void> {
    await this.locators.nameInput.fill(name);
  }

  /** Set the "Noisy" switch; idempotent via its aria-checked state. */
  async setNoisy(on: boolean): Promise<void> {
    const checked =
      (await this.locators.noisySwitch.getAttribute("aria-checked")) === "true";
    if (checked !== on) {
      await this.locators.noisySwitch.click();
    }
  }

  /** Create + select a tag via the creatable multi-select (type then Enter). */
  async addTag(tag: string): Promise<void> {
    await this.locators.tagsSelect.click();
    await this.locators.tagsSelect.pressSequentially(tag, { delay: 20 });
    await this.page.keyboard.press("Enter");
  }

  async save(): Promise<void> {
    await this.locators.saveButton.click();
  }
}
