import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { PresetWidgetForm } from "../preset-widget-form";
import { Preset } from "@/entities/presets/model/types";
import { CountBy } from "@/entities/presets/model/count-by";
import { PresetPanelType, WidgetData } from "../../../types";

jest.mock("../columns-selection", () => ({
  __esModule: true,
  default: () => null,
}));

const presets = [{ id: "p1", name: "feed" }] as unknown as Preset[];

const savedWidget = (overrides: Partial<WidgetData> = {}) =>
  ({
    preset: { id: "p1", name: "feed", countOfLastAlerts: 5 },
    presetPanelType: PresetPanelType.ALERT_COUNT_PANEL,
    thresholds: [{ value: 0, color: "#10b981" }],
    showFiringOnly: false,
    customLink: "",
    ...overrides,
  }) as unknown as WidgetData;

const lastValue = (onChange: jest.Mock) =>
  onChange.mock.calls[onChange.mock.calls.length - 1][0];

const renderForm = async (editingItem?: WidgetData) => {
  const onChange = jest.fn();
  render(
    <PresetWidgetForm
      presets={presets}
      editingItem={editingItem}
      onChange={onChange}
    />
  );
  await screen.findByRole("radiogroup", { name: "Count" });
  return onChange;
};

const expectNoLayoutKeys = (emitted: object) =>
  ["w", "h", "minW", "minH", "static"].forEach((key) =>
    expect(emitted).not.toHaveProperty(key)
  );

const choosePanelType = async (optionName: string) => {
  const root = document.querySelector(
    '[data-cy="dashboard-widget-form-panel-type-select"]'
  ) as HTMLElement;
  fireEvent.click(within(root).getByRole("button"));
  const listbox = await screen.findByRole("listbox");
  fireEvent.click(within(listbox).getByRole("option", { name: optionName }));
};

describe("PresetWidgetForm countBy", () => {
  it("emits no countBy for a new widget", async () => {
    const onChange = await renderForm();

    expect(Object.keys(lastValue(onChange))).toContain("countBy");
    expect(lastValue(onChange).countBy).toBeUndefined();
  });

  it("emits the chosen incident count", async () => {
    const onChange = await renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "Incidents" }));

    expect(lastValue(onChange).countBy).toEqual({
      field: "incident",
      incidentStatus: "active",
    });
  });

  it("loads the saved countBy when editing", async () => {
    const saved: CountBy = { field: "incident", incidentStatus: "firing" };
    const onChange = await renderForm(savedWidget({ countBy: saved }));

    expect(lastValue(onChange).countBy).toEqual(saved);
    expect(screen.getByRole("radio", { name: "Incidents" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("drops a saved countBy when the user goes back to counting alerts", async () => {
    const widget = savedWidget({
      countBy: { field: "incident", incidentStatus: "active" },
    });
    const onChange = await renderForm(widget);

    fireEvent.click(screen.getByRole("radio", { name: "Alerts" }));

    const emitted = lastValue(onChange);
    expect(Object.keys(emitted)).toContain("countBy");
    expect(emitted.countBy).toBeUndefined();
    const merged = { ...widget, ...emitted };
    expect(merged.countBy).toBeUndefined();
  });

  it("offers the control for the alert table panel too", async () => {
    await renderForm(savedWidget({ presetPanelType: PresetPanelType.ALERT_TABLE }));

    expect(screen.getByRole("radiogroup", { name: "Count" })).toBeInTheDocument();
  });
});

describe("PresetWidgetForm layout for a new counter tile", () => {
  it("gives a new grouped counter four rows", async () => {
    const onChange = await renderForm();

    await choosePanelType("Alert Count Panel");
    fireEvent.click(screen.getByRole("radio", { name: "Incidents" }));

    await waitFor(() =>
      expect(lastValue(onChange)).toMatchObject({
        w: 4,
        h: 4,
        minW: 0,
        minH: 4,
        static: false,
      })
    );
  });

  it("still allows two rows for a new counter that counts alerts", async () => {
    const onChange = await renderForm();

    await choosePanelType("Alert Count Panel");

    await waitFor(() =>
      expect(lastValue(onChange)).toMatchObject({
        w: 4,
        h: 3,
        minW: 0,
        minH: 2,
        static: false,
      })
    );
  });

  it("leaves the layout of a saved ungrouped counter alone", async () => {
    const onChange = await renderForm(savedWidget({ h: 3 }));

    expectNoLayoutKeys(lastValue(onChange));
  });

  it("leaves a saved grouped counter that is already tall enough alone", async () => {
    const onChange = await renderForm(
      savedWidget({
        h: 4,
        countBy: { field: "incident", incidentStatus: "active" },
      })
    );

    expectNoLayoutKeys(lastValue(onChange));
  });
});

describe("PresetWidgetForm layout when editing a saved widget", () => {
  it("grows a three-row counter to four rows once it counts incidents", async () => {
    const onChange = await renderForm(savedWidget({ h: 3 }));

    fireEvent.click(screen.getByRole("radio", { name: "Incidents" }));

    await waitFor(() => expect(lastValue(onChange)).toMatchObject({ h: 4, minH: 4 }));
    ["w", "minW", "static"].forEach((key) =>
      expect(lastValue(onChange)).not.toHaveProperty(key)
    );
  });

  it("grows a two-row counter that counts another field", async () => {
    const onChange = await renderForm(savedWidget({ h: 2 }));

    fireEvent.click(screen.getByRole("radio", { name: "Other field" }));

    await waitFor(() => expect(lastValue(onChange)).toMatchObject({ h: 4, minH: 4 }));
  });

  it("treats a missing height as too short", async () => {
    const onChange = await renderForm(
      savedWidget({ countBy: { field: "incident", incidentStatus: "active" } })
    );

    expect(lastValue(onChange)).toMatchObject({ h: 4, minH: 4 });
  });

  it("does not shrink a counter that is taller than four rows", async () => {
    const onChange = await renderForm(savedWidget({ h: 5 }));

    fireEvent.click(screen.getByRole("radio", { name: "Incidents" }));

    await waitFor(() =>
      expect(lastValue(onChange).countBy).toEqual({
        field: "incident",
        incidentStatus: "active",
      })
    );
    expectNoLayoutKeys(lastValue(onChange));
  });

  it("stops asking for rows when the user goes back to counting alerts", async () => {
    const onChange = await renderForm(
      savedWidget({
        h: 3,
        countBy: { field: "incident", incidentStatus: "active" },
      })
    );

    fireEvent.click(screen.getByRole("radio", { name: "Alerts" }));

    await waitFor(() => expect(lastValue(onChange).countBy).toBeUndefined());
    expectNoLayoutKeys(lastValue(onChange));
  });

  it("leaves an alert table alone even when it counts incidents", async () => {
    const onChange = await renderForm(
      savedWidget({
        h: 3,
        presetPanelType: PresetPanelType.ALERT_TABLE,
        countBy: { field: "incident", incidentStatus: "active" },
      })
    );

    expectNoLayoutKeys(lastValue(onChange));
  });
});
