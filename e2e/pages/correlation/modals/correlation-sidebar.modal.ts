import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The create/edit correlation sidebar (CorrelationSidebar, data-cy="rules-sidebar"),
 * opened from the correlation page's "Create Correlation" button (or a row's edit).
 * It hosts the CorrelationForm + a CEL condition builder (RuleGroup/RuleFields) +
 * submit/cancel (CorrelationSubmission).
 *
 * data-cy coverage: the name/time-amount/incident-name-template/incident-prefix/
 * threshold inputs and the submit/cancel/delete buttons carry data-cy. Tremor
 * <Select>/<MultiSelect>/<SearchSelect>/<Switch> DON'T (Tremor drops data-cy; a
 * Select renders a hidden native <select title="select-hidden"> behind a <button>
 * trigger), so those are mapped structurally — by section label, hidden <select>
 * title, or role — and options are picked via `optionByName`. The CEL condition
 * builder has NO data-cy at all.
 */
export class CorrelationSidebar {
  readonly locators: {
    // --- shell -------------------------------------------------------------
    root: Locator;
    submitButton: Locator; // "Create correlation" / "Save correlation"
    cancelButton: Locator;
    optionByName: (name: string) => Locator; // any Tremor listbox option by label

    // --- text/number inputs (data-cy) --------------------------------------
    nameInput: Locator;
    timeAmountInput: Locator;
    incidentNameTemplateInput: Locator;
    incidentPrefixInput: Locator;
    thresholdInput: Locator;
    assigneeInput: Locator; // "Auto-assign to user" — no data-cy (label-scoped)

    // --- Tremor Selects/MultiSelect (no data-cy) ---------------------------
    timeUnitSelect: Locator; // Seconds/Minutes/Hours/Days
    resolveOnSelect: Locator; // No auto-resolution / All / First / Last resolved
    createOnSelect: Locator; // "Start incident on": Any / All conditions met
    groupedAttributesMultiSelect: Locator; // "Select attribute(s) to group by"

    // --- switches (no data-cy; accessible name comes from their label) ------
    requireApproveSwitch: Locator;
    multiLevelSwitch: Locator; // conditional on tenant config (multi_level_enabled)

    // --- CEL condition builder (RuleGroup/RuleFields) -----------------------
    addFilterButton: Locator; // "Add filter"
    // Per-group "Remove group" button — one per condition group; index with nth().
    // Disabled once only one group remains ("You must have at least one group").
    removeGroupButtons: Locator;
    // Per-condition FIELD dropdowns — the builder's only SearchSelects.
    conditionFieldSelects: Locator;
    // Per-condition VALUE input (data-cy added to RuleFields); index with the factory.
    conditionValueInput: (index: number) => Locator;
    // "N alert(s) were found" — matching-alerts badge; grouping only persists when
    // alerts are found (groupingCriteria: totalAlertsFound ? attrs : []).
    alertsFoundBadge: Locator;
  };

  constructor(readonly page: Page) {
    const root = page.locator('[data-cy="rules-sidebar"]');

    // A Tremor Select trigger is the <button> in the block that follows a given
    // section label. (Only works where the label's block has no other button.)
    const selectByLabel = (label: string) =>
      root.getByText(label, { exact: false }).locator("..").getByRole("button");

    this.locators = {
      root,
      submitButton: root.locator('[data-cy="rules-form-submit-btn"]'),
      cancelButton: root.locator('[data-cy="rules-form-cancel-btn"]'),
      // Exact match: several option labels are substrings of others (e.g. "status"
      // vs "status_disposable"), which would otherwise match multiple.
      optionByName: (name) => page.getByRole("option", { name, exact: true }),

      // text/number inputs
      nameInput: root.locator('[data-cy="rules-form-name-input"]'),
      timeAmountInput: root.locator('[data-cy="rules-form-time-amount-input"]'),
      incidentNameTemplateInput: root.locator(
        '[data-cy="rules-form-incident-name-template-input"]'
      ),
      incidentPrefixInput: root.locator('[data-cy="rules-form-incident-prefix-input"]'),
      thresholdInput: root.locator('[data-cy="rules-form-threshold-input"]'),
      assigneeInput: root
        .getByText("Auto-assign to user", { exact: false })
        .locator("..")
        .getByRole("textbox"),

      // Tremor Selects / MultiSelect (structural)
      // timeUnit sits in the first fieldset (name + timeframe); it's that section's
      // only hidden <select>. Click the wrapper (visible trigger sits over it).
      timeUnitSelect: root
        .locator("fieldset")
        .first()
        .locator('[title="select-hidden"]')
        .locator(".."),
      resolveOnSelect: selectByLabel("Resolve on"),
      createOnSelect: selectByLabel("Start incident on"),
      // The form's only MultiSelect.
      groupedAttributesMultiSelect: root.locator('[title="multi-select-hidden"]'),

      // switches — each gets its accessible name from its associated label.
      requireApproveSwitch: root.getByRole("switch", {
        name: "Created incidents require manual approve",
      }),
      multiLevelSwitch: root.getByRole("switch", { name: "Multi-level correlation" }),

      // CEL condition builder
      addFilterButton: root.getByRole("button", { name: "Add filter" }),
      // One "Remove group" button per condition group; index with nth().
      removeGroupButtons: root.getByRole("button", { name: "Remove group" }),
      // Field dropdowns (one per condition) — the builder's only SearchSelects.
      conditionFieldSelects: root.locator('[title="search-select-hidden"]').locator(".."),
      conditionValueInput: (index) =>
        root.locator('[data-cy="rules-form-condition-value-input"]').nth(index),
      // The FOUND badge starts with a count ("3 alerts were found"); the not-found
      // badge is "No alerts were found with this condition" — so require a digit.
      alertsFoundBadge: root.getByText(/\d+\s+alerts?\s+were found/i).first(),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }

  /**
   * Click an open listbox option by label. The sidebar re-renders while a menu is
   * open (matching-alerts polling / useWatch), which detaches the option mid-click
   * and defeats the stability wait — so wait for it, then retry a force-click
   * (fresh element each attempt) until it lands.
   */
  private async clickOption(value: string): Promise<void> {
    const option = this.locators.optionByName(value);
    await option.waitFor({ state: "visible" });
    await expect(async () => {
      await option.click({ force: true, timeout: 2_000 });
    }).toPass({ timeout: 15_000, intervals: [200, 500] });
  }

  /** Open a Tremor <Select> and click an option by label. */
  private async chooseFromSelect(trigger: Locator, value: string): Promise<void> {
    await trigger.click();
    await this.clickOption(value);
  }

  // --- text / number inputs -----------------------------------------------

  async fillName(name: string): Promise<void> {
    await this.locators.nameInput.fill(name);
  }

  async fillTimeAmount(value: string | number): Promise<void> {
    await this.locators.timeAmountInput.fill(String(value));
  }

  async fillIncidentNameTemplate(template: string): Promise<void> {
    await this.locators.incidentNameTemplateInput.fill(template);
  }

  async fillIncidentPrefix(prefix: string): Promise<void> {
    await this.locators.incidentPrefixInput.fill(prefix);
  }

  async fillThreshold(value: string | number): Promise<void> {
    await this.locators.thresholdInput.fill(String(value));
  }

  async fillAssignee(email: string): Promise<void> {
    await this.locators.assigneeInput.fill(email);
  }

  // --- dropdowns -----------------------------------------------------------

  /** "Seconds" | "Minutes" | "Hours" | "Days". */
  async selectTimeUnit(value: string): Promise<void> {
    await this.chooseFromSelect(this.locators.timeUnitSelect, value);
  }

  /** "No auto-resolution" | "All alerts resolved" | "First alert resolved" | "Last alert resolved". */
  async selectResolveOn(value: string): Promise<void> {
    await this.chooseFromSelect(this.locators.resolveOnSelect, value);
  }

  /** "Any condition met" | "All conditions met". */
  async selectCreateOn(value: string): Promise<void> {
    await this.chooseFromSelect(this.locators.createOnSelect, value);
  }

  /**
   * Select one or more group-by attributes in the Tremor MultiSelect. Open via
   * focus + ArrowDown (its trigger is badge-cluttered); each option click adds one.
   */
  async selectGroupedAttributes(attributes: string[]): Promise<void> {
    await this.locators.groupedAttributesMultiSelect.focus();
    await this.page.keyboard.press("ArrowDown");
    for (const attribute of attributes) {
      await this.clickOption(attribute);
    }
    // A multi-select stays open after picking; refocus its input and Escape to close.
    await this.locators.groupedAttributesMultiSelect.focus();
    await this.page.keyboard.press("Escape");
  }

  // --- switch --------------------------------------------------------------

  /** Set the "Created incidents require manual approve" switch (idempotent). */
  async setRequireApprove(enabled: boolean): Promise<void> {
    const isOn =
      (await this.locators.requireApproveSwitch.getAttribute("aria-checked")) === "true";
    if (isOn !== enabled) {
      await this.locators.requireApproveSwitch.click();
    }
  }

  // --- CEL condition builder ----------------------------------------------

  /** Fill a condition's value (defaults to the first/only condition). */
  async fillConditionValue(value: string, index = 0): Promise<void> {
    await this.locators.conditionValueInput(index).fill(value);
  }

  /** Fill every condition value input that exists (the default query has more than one). */
  async fillAllConditionValues(value: string): Promise<void> {
    const inputs = this.locators.root.locator(
      '[data-cy="rules-form-condition-value-input"]'
    );
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      await inputs.nth(i).fill(value);
    }
  }

  /**
   * Remove a condition GROUP by index (the default query starts with two OR'd
   * groups; index 1 is the second). The button disables once one group remains,
   * so this can't drop below the minimum. Removal re-renders the builder — do it
   * BEFORE filling condition values so the fill isn't disturbed.
   */
  async removeGroup(index = 1): Promise<void> {
    await this.locators.removeGroupButtons.nth(index).click();
  }

  /**
   * Wait until the query matches at least one alert ("N alerts were found").
   * Grouping criteria are only persisted when alerts are found at submit time.
   */
  async waitForMatchingAlerts(timeout = 30_000): Promise<void> {
    await expect(this.locators.alertsFoundBadge).toBeVisible({ timeout });
  }

  // --- buttons -------------------------------------------------------------

  async cancel(): Promise<void> {
    await this.locators.cancelButton.click();
  }

  /** Submit — "Create correlation" / "Save correlation". */
  async clickCreateCorrelation(): Promise<void> {
    await this.locators.submitButton.click();
  }
}
