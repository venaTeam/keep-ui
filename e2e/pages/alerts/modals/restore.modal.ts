import { type Locator, type Page } from "@playwright/test";

/**
 * Restore modal — the SAME component as the dismiss modal
 * (data-cy="alerts-dismiss-modal"), rendered in its restore branch when every
 * targeted alert is already suppressed (alert-dismiss-modal.tsx `isRestore`).
 * The row's action menu shows "Restore" instead of "Dismiss" for a suppressed
 * alert (alert-menu.tsx:520), but both open this one modal.
 *
 * Restore branch controls: a "New status" picker (react-select), an optional
 * restore-note textarea, and the restore-variant submit/cancel buttons. The root
 * data-cy is shared with dismiss, so the restore submit button is what
 * distinguishes this variant.
 */
export class RestoreModal {
  readonly locators: {
    root: Locator;
    combobox: Locator;
    option: (name: string) => Locator;
    note: Locator;
    submitButton: Locator;
    cancelButton: Locator;
  };

  constructor(readonly page: Page) {
    const root = page.locator('[data-cy="alerts-dismiss-modal"]');
    this.locators = {
      root,
      combobox: root.getByRole("combobox"),
      option: (name) => page.getByRole("option", { name }),
      note: root.locator("textarea"),
      submitButton: root.locator('[data-cy="alerts-restore-submit-btn"]'),
      cancelButton: root.locator('[data-cy="alerts-restore-cancel-btn"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }
  /** The restore-variant submit button — its presence distinguishes restore from dismiss. */
  get submitButton(): Locator {
    return this.locators.submitButton;
  }
  /** Optional restore-note textarea. */
  get note(): Locator {
    return this.locators.note;
  }

  /** Pick the new status to restore to (portal-rendered react-select options). */
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
