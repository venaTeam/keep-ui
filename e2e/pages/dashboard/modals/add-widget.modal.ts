import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The "Add Widget" modal (WidgetModal.tsx, data-cy="dashboard-widget-modal"),
 * opened from the dashboard's "Add Widget" button / empty state.
 *
 * The form is CONDITIONAL — a common header (name + Widget Type) plus a
 * type-specific sub-form that swaps on the selected Widget Type:
 *   Preset          -> preset sub-form (itself conditional on Panel Type)
 *   Generic Metrics -> generic-metrics sub-form
 *   Metric          -> metric sub-form
 *   Service Now     -> service-now sub-form (only when a ticket_count provider is installed)
 *
 * IMPORTANT: Tremor <Select>/<MultiSelect> DON'T forward data-cy (they render a
 * hidden native <select> behind a visible <button> trigger), so the many
 * `*-select` data-cy's in these forms DO NOT exist in the DOM. Those are mapped
 * structurally here (by section container / subtitle -> trigger button), and
 * options are picked via `optionByName`. TextInputs, the submit Button, and the
 * plain <div data-cy> section containers DO carry their data-cy.
 */
export class AddWidgetModal {
  readonly locators: {
    // --- trigger (on the dashboard page, not the modal) ---------------------
    openButton: Locator;

    // --- common ------------------------------------------------------------
    root: Locator;
    form: Locator;
    nameInput: Locator;
    typeSelect: Locator; // Tremor Select trigger (button)
    submitButton: Locator;
    /** Any Tremor Select/MultiSelect option by its visible label. */
    optionByName: (name: string) => Locator;

    // --- Preset sub-form (widgetType = "Preset") ---------------------------
    presetForm: Locator;
    presetSelect: Locator; // trigger
    panelTypeSelect: Locator; // trigger ("Alert Table" / "Alert Count Panel")
    // Panel Type = "Alert Table":
    countOfLastAlertsInput: Locator;
    columnsMultiSelect: Locator; // hidden <select> anchor (Tremor MultiSelect)
    // Panel Type = "Alert Count Panel":
    showFiringOnlySwitch: Locator;
    customLinkInput: Locator;
    // thresholds (both panel types):
    addThresholdButton: Locator;

    // --- Generic Metrics sub-form ------------------------------------------
    genericMetricsForm: Locator;
    genericMetricsSelect: Locator; // trigger

    // --- Metric sub-form ---------------------------------------------------
    metricForm: Locator;
    metricSelect: Locator; // trigger

    // --- Service Now sub-form (conditional) --------------------------------
    serviceNowForm: Locator;
    serviceNowTeamInput: Locator;
    serviceNowStatusSelect: Locator; // trigger (Open / In Progress / Both)
    serviceNowDetectionSelect: Locator; // trigger (Direct / Hamal / All)
    serviceNowCustomLinkInput: Locator;
  };

  constructor(readonly page: Page) {
    const root = page.locator('[data-cy="dashboard-widget-modal"]');
    const form = page.locator('[data-cy="dashboard-widget-form"]');
    const presetForm = form.locator('[data-cy="dashboard-widget-form-preset"]');
    const genericMetricsForm = form.locator('[data-cy="dashboard-widget-form-generic-metrics"]');
    const metricForm = form.locator('[data-cy="dashboard-widget-form-metric"]');
    const serviceNowForm = form.locator('[data-cy="dashboard-widget-form-service-now"]');

    // A Tremor Select trigger is the <button> in the block that follows a given
    // <Subtitle>; scope by the subtitle text, then take its section's button.
    const selectByLabel = (label: string) =>
      form.getByText(label, { exact: true }).locator("..").getByRole("button");

    this.locators = {
      openButton: page.locator('[data-cy="dashboard-add-widget-btn"]'),

      root,
      form,
      nameInput: form.locator('[data-cy="dashboard-widget-form-name-input"]'),
      typeSelect: selectByLabel("Widget Type"),
      submitButton: form.locator('[data-cy="dashboard-widget-form-submit-btn"]'),
      optionByName: (name) => page.getByRole("option", { name }),

      presetForm,
      presetSelect: presetForm.getByRole("button"),
      panelTypeSelect: selectByLabel("Panel Type"),
      countOfLastAlertsInput: form.locator(
        '[data-cy="dashboard-widget-form-count-of-last-alerts-input"]'
      ),
      // Tremor MultiSelect (data-cy dropped); the modal's only multi-select.
      columnsMultiSelect: form.locator('[title="multi-select-hidden"]'),
      // "Show Firing Alerts Only" — the modal's only switch.
      showFiringOnlySwitch: form.getByRole("switch"),
      customLinkInput: form.locator('[data-cy="dashboard-widget-form-custom-link-input"]'),
      addThresholdButton: form
        .getByText("Thresholds", { exact: true })
        .locator("..")
        .getByRole("button")
        .first(),

      genericMetricsForm,
      genericMetricsSelect: genericMetricsForm.getByRole("button"),

      metricForm,
      metricSelect: metricForm.getByRole("button"),

      serviceNowForm,
      serviceNowTeamInput: form.locator(
        '[data-cy="dashboard-widget-form-service-now-team-input"]'
      ),
      serviceNowStatusSelect: selectByLabel("INC Status"),
      serviceNowDetectionSelect: selectByLabel("Detection Method"),
      serviceNowCustomLinkInput: form.locator(
        '[data-cy="dashboard-widget-form-service-now-custom-link-input"]'
      ),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }

  /**
   * Open a Tremor <Select> (single) and click an option by label. The visible
   * trigger is a <button>; options render with role="option".
   */
  private async chooseFromSelect(trigger: Locator, value: string): Promise<void> {
    await trigger.click();
    await this.locators.optionByName(value).click();
  }

  // --- open ----------------------------------------------------------------

  /** Open the Add Widget modal from the dashboard's "Add Widget" button. */
  async open(): Promise<void> {
    await this.locators.openButton.click();
    await expect(this.locators.root).toBeVisible();
  }

  // --- common --------------------------------------------------------------

  async fillName(name: string): Promise<void> {
    await this.locators.nameInput.fill(name);
  }

  /** Choose the Widget Type: "Preset" | "Generic Metrics" | "Metric" | "Service Now". */
  async selectType(value: string): Promise<void> {
    await this.chooseFromSelect(this.locators.typeSelect, value);
  }

  /** Submit ("Add Widget" / "Update Widget"). */
  async submit(): Promise<void> {
    await this.locators.submitButton.click();
  }

  // --- Preset sub-form -----------------------------------------------------

  async selectPreset(name: string): Promise<void> {
    await this.chooseFromSelect(this.locators.presetSelect, name);
  }

  /** Choose the Panel Type: "Alert Table" | "Alert Count Panel". */
  async selectPanelType(value: string): Promise<void> {
    await this.chooseFromSelect(this.locators.panelTypeSelect, value);
  }

  /** Panel Type = Alert Table. */
  async fillCountOfLastAlerts(value: string | number): Promise<void> {
    await this.locators.countOfLastAlertsInput.fill(String(value));
  }

  /**
   * Panel Type = Alert Table. Select one or more columns in the Tremor
   * MultiSelect. Open via focus + ArrowDown (its trigger is badge-cluttered);
   * each option click adds a column, then close.
   */
  async selectColumns(columns: string[]): Promise<void> {
    await this.locators.columnsMultiSelect.focus();
    await this.page.keyboard.press("ArrowDown");
    for (const column of columns) {
      await this.locators.optionByName(column).click();
    }
    await this.page.keyboard.press("Escape");
  }

  /** Panel Type = Alert Count Panel. Set the "Show Firing Alerts Only" switch. */
  async setShowFiringOnly(enabled: boolean): Promise<void> {
    const isOn =
      (await this.locators.showFiringOnlySwitch.getAttribute("aria-checked")) === "true";
    if (isOn !== enabled) {
      await this.locators.showFiringOnlySwitch.click();
    }
  }

  /** Panel Type = Alert Count Panel. */
  async fillCustomLink(url: string): Promise<void> {
    await this.locators.customLinkInput.fill(url);
  }

  /** Add an (empty) threshold row via the Thresholds "+" button. */
  async addThreshold(): Promise<void> {
    await this.locators.addThresholdButton.click();
  }

  // --- Generic Metrics sub-form -------------------------------------------

  async selectGenericMetrics(value: string): Promise<void> {
    await this.chooseFromSelect(this.locators.genericMetricsSelect, value);
  }

  // --- Metric sub-form -----------------------------------------------------

  async selectMetric(name: string): Promise<void> {
    await this.chooseFromSelect(this.locators.metricSelect, name);
  }

  // --- Service Now sub-form ------------------------------------------------

  async fillServiceNowTeam(team: string): Promise<void> {
    await this.locators.serviceNowTeamInput.fill(team);
  }

  /** "Open" | "In Progress" | "Both". */
  async selectServiceNowStatus(value: string): Promise<void> {
    await this.chooseFromSelect(this.locators.serviceNowStatusSelect, value);
  }

  /** "Direct" | "Hamal" | "All". */
  async selectServiceNowDetection(value: string): Promise<void> {
    await this.chooseFromSelect(this.locators.serviceNowDetectionSelect, value);
  }

  async fillServiceNowCustomLink(url: string): Promise<void> {
    await this.locators.serviceNowCustomLinkInput.fill(url);
  }
}
