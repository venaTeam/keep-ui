import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The incident create/edit modal form (data-cy="incidents-form") — name +
 * ReactQuill summary + assignee + "resolve when all alerts resolved" switch. The
 * SAME component backs create and edit (edit just pre-fills it and its submit
 * button reads "Update"); the page's `openCreateForm()` / `openEditForm()` both
 * return this. Lives in its own file so the page object stays about the list.
 *
 * NOTE: the severity picker renders in this form but is NOT persisted on edit
 * (create-or-update-incident-form.tsx `handleSubmit` omits it in editMode), so
 * this object intentionally exposes no severity control.
 *
 * Locator convention: all locators centralized in the `locators` map; methods
 * reference `this.locators.*` and never build a locator inline.
 */
export class IncidentForm {
  readonly locators: {
    root: Locator;
    nameInput: Locator;
    summaryEditor: Locator;
    assigneeInput: Locator;
    severitySelect: Locator;
    severityOption: (label: string) => Locator;
    resolveOnSwitch: Locator;
    submitButton: Locator;
  };

  constructor(readonly page: Page) {
    const root = page.locator('[data-cy="incidents-form"]');
    this.locators = {
      root,
      nameInput: root.locator('[data-cy="incidents-form-name-input"]'),
      summaryEditor: root.locator(".ql-editor").first(),
      assigneeInput: root.locator('[data-cy="incidents-form-assignee-input"]'),
      severitySelect: root.locator('[data-cy="incidents-severity-select"]'),
      // react-select options carry role="option"; the accessible name may include
      // the option's severity icon tooltip, so match by (non-exact) label text.
      severityOption: (label) => page.getByRole("option", { name: label }),
      resolveOnSwitch: root.locator(
        '[data-cy="incidents-form-resolve-on-alerts-switch"]'
      ),
      submitButton: root.locator('[data-cy="incidents-form-submit-btn"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }

  /** The name input — exposed so specs can read its value for UI validation. */
  get nameInput(): Locator {
    return this.locators.nameInput;
  }

  async fillName(name: string): Promise<void> {
    await this.locators.nameInput.fill(name);
  }

  async fillAssignee(assignee: string): Promise<void> {
    await this.locators.assigneeInput.fill(assignee);
  }

  /**
   * Pick a severity from the "Severity" dropdown (react-select, not searchable).
   * Clicking the wrapper <div> doesn't reliably focus the control, so focus the
   * combobox input directly and open the menu with ArrowDown, retrying until the
   * option appears; then click it. Options carry role="option" ("Critical",
   * "High", "Warning", "Low", "Info").
   */
  async selectSeverity(label: string): Promise<void> {
    const combobox = this.locators.severitySelect.getByRole("combobox");
    const option = this.locators.severityOption(label);
    await expect(async () => {
      await combobox.focus();
      await combobox.press("ArrowDown");
      await expect(option).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 15_000, intervals: [300, 700] });
    await option.click();
  }

  /**
   * Set the "Resolve when all alerts are resolved" switch. Checked maps to
   * resolve_on="all_resolved", unchecked to "never" (role=switch aria-checked).
   * Idempotent — clicks only when the current state differs.
   */
  async setResolveOnAllResolved(enabled: boolean): Promise<void> {
    const sw = this.locators.resolveOnSwitch;
    const isOn = (await sw.getAttribute("aria-checked")) === "true";
    if (isOn !== enabled) {
      await sw.click();
    }
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
