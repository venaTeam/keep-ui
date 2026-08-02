import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The create/edit deduplication sidebar (DeduplicationSidebar), opened from the
 * deduplication page's "Create Deduplication Rule" button (or a row click for
 * edit). It renders inside a headlessui SidePanel Dialog; the FORM carries
 * data-cy="dedup-sidebar" and holds every field plus cancel/submit, while the
 * title and the top-right close (X) live in the panel header — inside the dialog
 * but OUTSIDE the form.
 *
 * data-cy coverage: name/description inputs and cancel/submit carry data-cy. The
 * provider / fingerprint-fields / ignore-fields controls are the shared react-
 * select (`@/shared/ui` Select) wrapped in a <div data-cy=...> — so the data-cy is
 * on the WRAPPER; interact via the inner combobox (type to filter + Enter). The
 * "Full deduplication" toggle is a Tremor <Switch> with NO data-cy (the form's
 * only role="switch"); enabling it reveals the Ignore-fields select.
 *
 * Fields are required by the form (name, description, provider, ≥1 fingerprint
 * field), so Save stays effectively unusable until those are set. Provider and all
 * fields are DISABLED when editing a default/provisioned rule.
 */
export class DeduplicationSidebar {
  readonly locators: {
    // --- shell -------------------------------------------------------------
    dialog: Locator; // the SidePanel dialog (role="dialog")
    root: Locator; // the <form data-cy="dedup-sidebar"> — all fields + buttons
    title: Locator; // Dialog.Title ("Add deduplication rule" / "Edit <name>")
    closeButton: Locator; // header X (no data-cy)
    optionByName: (name: string) => Locator; // an open react-select option by label

    // --- fields ------------------------------------------------------------
    nameInput: Locator; // dedup-form-name-input
    descriptionInput: Locator; // dedup-form-description-input
    providerSelect: Locator; // dedup-form-provider-select (react-select wrapper)
    fingerprintFieldsSelect: Locator; // dedup-form-fingerprint-fields-select (multi)
    fullDeduplicationSwitch: Locator; // Tremor Switch (no data-cy)
    ignoreFieldsSelect: Locator; // dedup-form-ignore-fields-select (multi; full-dedup only)

    // --- buttons -----------------------------------------------------------
    cancelButton: Locator; // dedup-form-cancel-btn
    submitButton: Locator; // dedup-form-submit-btn ("Save" / "Saving...")
  };

  constructor(readonly page: Page) {
    const dialog = page.getByRole("dialog");
    const root = page.locator('[data-cy="dedup-sidebar"]');
    this.locators = {
      dialog,
      root,
      // Dialog.Title always renders with this id, whatever tag it uses.
      title: page.locator('[id^="headlessui-dialog-title"]'),
      // The X is the header's (and dialog's) first button, before the form.
      closeButton: dialog.getByRole("button").first(),
      optionByName: (name) => page.getByRole("option", { name }),

      nameInput: root.locator('[data-cy="dedup-form-name-input"]'),
      descriptionInput: root.locator('[data-cy="dedup-form-description-input"]'),
      providerSelect: root.locator('[data-cy="dedup-form-provider-select"]'),
      fingerprintFieldsSelect: root.locator(
        '[data-cy="dedup-form-fingerprint-fields-select"]'
      ),
      // The form's only switch.
      fullDeduplicationSwitch: root.getByRole("switch"),
      ignoreFieldsSelect: root.locator('[data-cy="dedup-form-ignore-fields-select"]'),

      cancelButton: root.locator('[data-cy="dedup-form-cancel-btn"]'),
      submitButton: root.locator('[data-cy="dedup-form-submit-btn"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }

  /**
   * Pick a value in a react-select control: focus its combobox, type to filter,
   * then Enter to select the highlighted match. Works for single- and multi-select
   * (multi keeps the menu open; the input clears after each pick).
   */
  private async chooseOption(select: Locator, value: string): Promise<void> {
    const input = select.getByRole("combobox");
    await input.click();
    await input.pressSequentially(value);
    await input.press("Enter");
  }

  // --- text inputs ---------------------------------------------------------

  async fillName(name: string): Promise<void> {
    await this.locators.nameInput.fill(name);
  }

  async fillDescription(description: string): Promise<void> {
    await this.locators.descriptionInput.fill(description);
  }

  // --- react-select fields -------------------------------------------------

  /** Select the provider (single). Pass the option label as shown in the dropdown. */
  async selectProvider(label: string): Promise<void> {
    await this.chooseOption(this.locators.providerSelect, label);
  }

  /** Add one or more fingerprint fields (multi-select). */
  async selectFingerprintFields(fields: string[]): Promise<void> {
    for (const field of fields) {
      await this.chooseOption(this.locators.fingerprintFieldsSelect, field);
    }
    await this.page.keyboard.press("Escape"); // close the still-open menu
  }

  /** Add one or more ignore fields (multi-select; requires Full deduplication ON). */
  async selectIgnoreFields(fields: string[]): Promise<void> {
    for (const field of fields) {
      await this.chooseOption(this.locators.ignoreFieldsSelect, field);
    }
    await this.page.keyboard.press("Escape");
  }

  // --- switch --------------------------------------------------------------

  /** Set the "Full deduplication" switch (idempotent). Enabling reveals Ignore fields. */
  async setFullDeduplication(enabled: boolean): Promise<void> {
    const isOn =
      (await this.locators.fullDeduplicationSwitch.getAttribute("aria-checked")) ===
      "true";
    if (isOn !== enabled) {
      await this.locators.fullDeduplicationSwitch.click();
    }
  }

  // --- buttons -------------------------------------------------------------

  async cancel(): Promise<void> {
    await this.locators.cancelButton.click();
  }

  /** Close via the header X (equivalent to Cancel; both just toggle the panel shut). */
  async close(): Promise<void> {
    await this.locators.closeButton.click();
  }

  /** Submit the form — the "Save" button. */
  async submit(): Promise<void> {
    await this.locators.submitButton.click();
  }
}
