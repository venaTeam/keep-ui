import { expect, type Locator, type Page } from "@playwright/test";

export class CreateMwPage {
    readonly locators: {
        nameField: Locator,
        descriptionField: Locator,
        celField: Locator,
        statusDropdown: Locator,
        durationNumberField: Locator,
        durationUnitDropdown: Locator,
        displayModeDropdown: Locator,
        enableRuleToggle: Locator,
        createButton: Locator,
        // Listbox/combobox option by its visible label (shared by the dropdowns).
        optionByName: (name: string) => Locator,
        // "Start At" inline react-datepicker (calendar + time column).
        calendar: Locator,
        nextMonthButton: Locator,
        dayOption: (day: number) => Locator,
        timeList: Locator,
        timeOption: (time: string) => Locator,
        // A row in the maintenance-rules table (right column), by rule name.
        ruleRow: (name: string) => Locator
    }

    constructor(readonly page: Page) {
        const form = page.locator('[data-cy="maintenance-create-modal"]');
        const calendar = form.locator('.react-datepicker');
        const timeList = calendar.locator('.react-datepicker__time-list');
        this.locators = {
            nameField: form.locator('[data-cy="maintenance-form-name-input"]'),
            descriptionField: form.locator('[data-cy="maintenance-form-description-input"]'),
            celField: form.locator('[data-cy="cel-input"]'),
            // Tremor MultiSelect/Select DON'T forward data-cy and expose no stable
            // class. The MultiSelect's visible trigger is one big button full of
            // removable badges (clicking its center removes a selected badge), so we
            // instead anchor on its hidden native <select> (title="multi-select-hidden")
            // and drive it via focus+keyboard (see selectStatus). Each plain Select's
            // trigger is a <button> scoped by its section label.
            statusDropdown: form.locator('[title="multi-select-hidden"]'),
            durationNumberField: form.getByText('End After').locator('..').getByRole('spinbutton'),
            durationUnitDropdown: form.getByText('End After').locator('..').getByRole('button'),
            displayModeDropdown: form
                .getByText('Alerts Display Mode', { exact: true })
                .locator('..')
                .getByRole('button'),
            enableRuleToggle: form.getByRole('switch'),
            createButton: form.locator('[data-cy="maintenance-form-submit-btn"]'),
            optionByName: (name) => page.getByRole('option', { name }),
            calendar,
            nextMonthButton: calendar.locator('.react-datepicker__navigation--next'),
            dayOption: (day) =>
                calendar
                    .locator('.react-datepicker__day:not(.react-datepicker__day--outside-month)')
                    .filter({ hasText: new RegExp(`^${day}$`) }),
            timeList,
            timeOption: (time) => timeList.getByText(time, { exact: true }),
            ruleRow: (name) =>
                page.locator('[data-cy="maintenance-row"]').filter({ hasText: name }),
        }
    }

    /** Navigate to the maintenance page (the create form renders inline). */
    async goto(): Promise<void> {
        await this.page.goto('/maintenance');
        await expect(this.locators.nameField).toBeVisible();
    }

    async typeName(name: string): Promise<void> {
        await this.locators.nameField.fill(name);
    }

    async typeDescription(description: string): Promise<void> {
        await this.locators.descriptionField.fill(description);
    }

    async typeCel(cel: string): Promise<void> {
        // The CEL field is a Monaco editor. Click the editor to focus it (the
        // [data-cy] wrapper alone doesn't focus Monaco), clear, then INSERT the whole
        // string in one shot — per-key typing drops characters and triggers Monaco's
        // auto-close, so `insertText` is both more reliable and exact.
        const editor = this.locators.celField.locator('.monaco-editor').first();
        await editor.click();
        await this.page.keyboard.press('ControlOrMeta+A');
        await this.page.keyboard.press('Backspace');
        await this.page.keyboard.insertText(cel);
        await expect(this.locators.celField).toContainText(cel);
        // The builder pops a suggestions overlay on focus; dismiss it by clicking
        // outside the CEL wrapper (its click-outside handler closes it).
        await this.locators.nameField.click();
    }

    async typeDurationNumber(value: string | number): Promise<void> {
        await this.locators.durationNumberField.fill(String(value));
    }

    async chooseDurationUnit(value: string): Promise<void> {
        await this.locators.durationUnitDropdown.click();
        await this.locators.optionByName(value).click();
    }

    async chooseDisplayMode(value: string): Promise<void> {
        await this.locators.displayModeDropdown.click();
        await this.locators.optionByName(value).click();
    }

    async selectStatus(value: string): Promise<void> {
        // Open via focus + ArrowDown rather than clicking the trigger: the trigger
        // is full of removable badges, so a center-click would delete a selected
        // status. Focusing the hidden <select> redirects focus to the real combobox
        // input (its onFocus), and ArrowDown opens the option list.
        await this.locators.statusDropdown.focus();
        await this.page.keyboard.press('ArrowDown');
        await this.locators.optionByName(value).click();
        await this.page.keyboard.press('Escape');
    }

    /** Advance the "Start At" calendar one month (for picking a day past month-end). */
    async goToNextMonth(): Promise<void> {
        await this.locators.nextMonthButton.click();
    }

    async selectDate(day: number): Promise<void> {
        await this.locators.dayOption(day).click();
    }

    /** A maintenance-rules table row by rule name (right column of the page). */
    ruleRow(name: string): Locator {
        return this.locators.ruleRow(name);
    }

    async selectTime(time: string): Promise<void> {
        await this.locators.timeOption(time).click();
    }

    async switchEnableRuleToggle(): Promise<void> {
        await this.locators.enableRuleToggle.click();
    }

    async clickCreate(): Promise<void> {
        await this.locators.createButton.click();
    }
}
