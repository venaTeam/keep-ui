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
  default: () => <div data-cy="dashboard-widget-form-columns-multiselect" />,
}));

jest.mock("@/features/filter/hooks", () => ({
  useFacetPotentialFields: () => ({
    data: [
      "labels.team",
      "service",
      "checkbox",
      "severity",
      "extraPayload",
      "last_received",
      "description",
    ],
  }),
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

const expectNoFootprintKeys = (emitted: object) =>
  ["w", "minW", "static"].forEach((key) =>
    expect(emitted).not.toHaveProperty(key)
  );

const expectOnlyMinH = (emitted: object, minH: number) => {
  expect(emitted).toHaveProperty("minH", minH);
  expect(emitted).not.toHaveProperty("h");
  expectNoFootprintKeys(emitted);
};

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

describe("PresetWidgetForm firing-only toggle", () => {
  const FIRING_ONLY = "Show Firing Alerts Only";

  it("offers the toggle when counting alerts", async () => {
    await renderForm(savedWidget());

    expect(screen.getByText(FIRING_ONLY)).toBeInTheDocument();
  });

  it("offers the toggle when counting another field", async () => {
    await renderForm(savedWidget({ countBy: { field: "service" } }));

    expect(screen.getByText(FIRING_ONLY)).toBeInTheDocument();
  });

  it("hides the toggle when counting incidents", async () => {
    await renderForm(
      savedWidget({ countBy: { field: "incident", incidentStatus: "active" } })
    );

    expect(screen.queryByText(FIRING_ONLY)).not.toBeInTheDocument();
  });

  it("restores the toggle with the earlier choice when the user returns to alerts", async () => {
    const onChange = await renderForm(savedWidget({ showFiringOnly: true }));

    fireEvent.click(screen.getByRole("radio", { name: "Incidents" }));
    await waitFor(() =>
      expect(screen.queryByText(FIRING_ONLY)).not.toBeInTheDocument()
    );
    expect(lastValue(onChange).showFiringOnly).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "Alerts" }));
    expect(await screen.findByText(FIRING_ONLY)).toBeInTheDocument();
    expect(lastValue(onChange).showFiringOnly).toBe(true);
  });

  it("keeps emitting the saved choice for an incident count", async () => {
    const onChange = await renderForm(
      savedWidget({
        showFiringOnly: true,
        countBy: { field: "incident", incidentStatus: "active" },
      })
    );

    expect(lastValue(onChange).showFiringOnly).toBe(true);
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

  it("emits only the two-row minimum for a saved ungrouped counter", async () => {
    const onChange = await renderForm(savedWidget({ h: 3 }));

    expectOnlyMinH(lastValue(onChange), 2);
  });

  it("emits only the four-row minimum for a saved grouped counter that is already tall enough", async () => {
    const onChange = await renderForm(
      savedWidget({
        h: 4,
        countBy: { field: "incident", incidentStatus: "active" },
      })
    );

    expectOnlyMinH(lastValue(onChange), 4);
  });
});

describe("PresetWidgetForm layout when editing a saved widget", () => {
  it("grows a three-row counter to four rows once it counts incidents", async () => {
    const onChange = await renderForm(savedWidget({ h: 3 }));

    fireEvent.click(screen.getByRole("radio", { name: "Incidents" }));

    await waitFor(() => expect(lastValue(onChange)).toMatchObject({ h: 4, minH: 4 }));
    expectNoFootprintKeys(lastValue(onChange));
  });

  it("grows a two-row counter that counts another field", async () => {
    const onChange = await renderForm(savedWidget({ h: 2 }));

    fireEvent.click(screen.getByRole("radio", { name: "Other field" }));

    await waitFor(() => expect(lastValue(onChange)).toMatchObject({ h: 4, minH: 4 }));
    expectNoFootprintKeys(lastValue(onChange));
  });

  it("treats a missing height as too short", async () => {
    const onChange = await renderForm(
      savedWidget({ countBy: { field: "incident", incidentStatus: "active" } })
    );

    expect(lastValue(onChange)).toMatchObject({ h: 4, minH: 4 });
    expectNoFootprintKeys(lastValue(onChange));
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
    expectOnlyMinH(lastValue(onChange), 4);
  });

  it("lowers the minimum back to two rows when the user goes back to counting alerts", async () => {
    const onChange = await renderForm(
      savedWidget({
        h: 3,
        countBy: { field: "incident", incidentStatus: "active" },
      })
    );

    fireEvent.click(screen.getByRole("radio", { name: "Alerts" }));

    await waitFor(() => expect(lastValue(onChange).countBy).toBeUndefined());
    expectOnlyMinH(lastValue(onChange), 2);
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

describe("PresetWidgetForm layout with the left-out alerts strip", () => {
  const incidents: CountBy = { field: "incident", incidentStatus: "active" };

  const clickMissingToggle = () => {
    const root = document.querySelector(
      '[data-cy="dashboard-widget-form-count-missing"]'
    ) as HTMLElement;
    fireEvent.click(within(root).getByRole("switch"));
  };

  it("gives a new grouped counter with the strip five rows", async () => {
    const onChange = await renderForm();

    await choosePanelType("Alert Count Panel");
    fireEvent.click(screen.getByRole("radio", { name: "Incidents" }));
    clickMissingToggle();

    await waitFor(() =>
      expect(lastValue(onChange)).toMatchObject({
        w: 4,
        h: 5,
        minW: 0,
        minH: 5,
        static: false,
        countBy: { ...incidents, showMissing: true },
      })
    );
  });

  it("grows a four-row grouped counter to five rows when the strip is turned on", async () => {
    const onChange = await renderForm(savedWidget({ h: 4, countBy: incidents }));

    clickMissingToggle();

    await waitFor(() =>
      expect(lastValue(onChange)).toMatchObject({ h: 5, minH: 5 })
    );
    expectNoFootprintKeys(lastValue(onChange));
  });

  it("emits only the five-row minimum for a counter with the strip that is tall enough", async () => {
    const onChange = await renderForm(
      savedWidget({ h: 6, countBy: { ...incidents, showMissing: true } })
    );

    expectOnlyMinH(lastValue(onChange), 5);
  });

  it("lowers the minimum to four rows when the strip is turned off and keeps the height", async () => {
    const onChange = await renderForm(
      savedWidget({ h: 5, countBy: { ...incidents, showMissing: true } })
    );

    clickMissingToggle();

    await waitFor(() =>
      expect(lastValue(onChange).countBy).toEqual({
        ...incidents,
        showMissing: false,
      })
    );
    expectOnlyMinH(lastValue(onChange), 4);
  });
});

describe("PresetWidgetForm row grouping", () => {
  const HINT = "Grouping works best with 20 or more alerts";

  const tableWidget = (overrides: Partial<WidgetData> = {}) =>
    savedWidget({ presetPanelType: PresetPanelType.ALERT_TABLE, ...overrides });

  const groupRowsBy = () =>
    document.querySelector(
      '[data-cy="dashboard-widget-form-group-rows-by"]'
    ) as HTMLElement | null;

  const rowsWithNoValue = () =>
    document.querySelector(
      '[data-cy="dashboard-widget-form-rows-with-no-value"]'
    ) as HTMLElement | null;

  const openGroupRowsBy = async () => {
    fireEvent.click(
      within(groupRowsBy() as HTMLElement).getByRole("button", {
        name: "Show Group rows by options",
      })
    );
    return screen.findByRole("listbox");
  };

  const chooseGroupBy = async (name: string) => {
    const listbox = await openGroupRowsBy();
    fireEvent.mouseDown(within(listbox).getByRole("option", { name }));
  };

  const follows = (first: Element, second: Element) =>
    !!(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
    );

  it("emits alertTable.groupBy when a group is chosen, keeping other alertTable keys", async () => {
    const onChange = await renderForm(
      tableWidget({ alertTable: { columnOrder: ["name"] } })
    );

    await chooseGroupBy("Incident");

    await waitFor(() =>
      expect(lastValue(onChange).alertTable).toEqual({
        columnOrder: ["name"],
        groupBy: "incident",
        emptyGroupPosition: "top",
      })
    );
  });

  it("removes the grouping keys when None is chosen and keeps the rest", async () => {
    const onChange = await renderForm(
      tableWidget({
        alertTable: {
          columnOrder: ["name"],
          groupBy: "service",
          emptyGroupPosition: "bottom",
        },
      })
    );

    await chooseGroupBy("None");

    await waitFor(() =>
      expect(lastValue(onChange).alertTable).toEqual({ columnOrder: ["name"] })
    );
    expect(lastValue(onChange).alertTable).not.toHaveProperty("groupBy");
    expect(lastValue(onChange).alertTable).not.toHaveProperty(
      "emptyGroupPosition"
    );
  });

  it("emits alertTable undefined when None leaves nothing else", async () => {
    const widget = tableWidget({
      alertTable: { groupBy: "service", emptyGroupPosition: "top" },
    });
    const onChange = await renderForm(widget);

    await chooseGroupBy("None");

    await waitFor(() => expect(lastValue(onChange).alertTable).toBeUndefined());
    const emitted = lastValue(onChange);
    expect(Object.keys(emitted)).toContain("alertTable");
    expect({ ...widget, ...emitted }.alertTable).toBeUndefined();
  });

  it("adds no alertTable to an ungrouped table widget", async () => {
    const onChange = await renderForm(tableWidget());

    expect(Object.keys(lastValue(onChange))).toContain("alertTable");
    expect(lastValue(onChange).alertTable).toBeUndefined();
  });

  it("loads the saved grouping when editing", async () => {
    const saved = {
      columnSizing: { name: 200 },
      groupBy: "service",
      emptyGroupPosition: "bottom" as const,
    };
    const onChange = await renderForm(tableWidget({ alertTable: saved }));

    expect(
      within(groupRowsBy() as HTMLElement).getByRole("combobox", {
        name: "Group rows by",
      })
    ).toHaveValue("Service");
    expect(screen.getByRole("radio", { name: "Bottom" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(lastValue(onChange).alertTable).toEqual(saved);
  });

  it("shows 'Rows with no value' only when rows are grouped, and emits the chosen position", async () => {
    const onChange = await renderForm(tableWidget());

    expect(rowsWithNoValue()).toBeNull();
    expect(screen.queryByText("Rows with no value")).not.toBeInTheDocument();

    await chooseGroupBy("Service");

    expect(await screen.findByText("Rows with no value")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Top" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    fireEvent.click(screen.getByRole("radio", { name: "Bottom" }));

    await waitFor(() =>
      expect(lastValue(onChange).alertTable).toEqual({
        groupBy: "service",
        emptyGroupPosition: "bottom",
      })
    );
  });

  it("places Group rows by after the Columns picker and Rows with no value after it", async () => {
    await renderForm(tableWidget({ alertTable: { groupBy: "incident" } }));

    const columns = document.querySelector(
      '[data-cy="dashboard-widget-form-columns-multiselect"]'
    ) as HTMLElement;
    const count = document.querySelector(
      '[data-cy="dashboard-widget-form-count-by"]'
    ) as HTMLElement;
    expect(follows(count, columns)).toBe(true);
    expect(follows(columns, groupRowsBy() as HTMLElement)).toBe(true);
    expect(
      follows(groupRowsBy() as HTMLElement, rowsWithNoValue() as HTMLElement)
    ).toBe(true);
    expect(screen.getByText("Group rows by")).toBeInTheDocument();
  });

  it("offers the alert facet fields under 'Any other field…'", async () => {
    await renderForm(tableWidget());

    const listbox = await openGroupRowsBy();

    const others = within(listbox).getByRole("group", {
      name: "Any other field…",
    });
    expect(
      within(others)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["description", "labels.team", "lastReceived"]);
  });

  it("leaves the ungroupable severity and extraPayload columns out", async () => {
    await renderForm(tableWidget());

    const listbox = await openGroupRowsBy();

    expect(
      within(listbox).queryByRole("option", { name: "severity" })
    ).toBeNull();
    expect(
      within(listbox).queryByRole("option", { name: "extraPayload" })
    ).toBeNull();
    expect(
      within(listbox).getByRole("option", { name: "description" })
    ).toBeInTheDocument();
  });

  it("offers and stores a facet id under the table's column id", async () => {
    const onChange = await renderForm(tableWidget());

    const listbox = await openGroupRowsBy();
    expect(
      within(listbox).queryByRole("option", { name: "last_received" })
    ).toBeNull();
    fireEvent.mouseDown(
      within(listbox).getByRole("option", { name: "lastReceived" })
    );

    await waitFor(() =>
      expect(lastValue(onChange).alertTable).toEqual({
        groupBy: "lastReceived",
        emptyGroupPosition: "top",
      })
    );
  });

  it("shows the hint when grouped with fewer than 10 alerts", async () => {
    await renderForm(tableWidget());

    expect(screen.queryByText(HINT)).not.toBeInTheDocument();

    await chooseGroupBy("Incident");

    expect(await screen.findByText(HINT)).toBeInTheDocument();
  });

  it("shows the hint only while the alert count is under 10", async () => {
    await renderForm(
      tableWidget({
        preset: {
          id: "p1",
          name: "feed",
          countOfLastAlerts: 25,
        } as unknown as Preset,
        alertTable: { groupBy: "incident" },
      })
    );

    expect(screen.queryByText(HINT)).not.toBeInTheDocument();

    const countInput = document.querySelector(
      'input[data-cy="dashboard-widget-form-count-of-last-alerts-input"]'
    ) as HTMLInputElement;
    fireEvent.change(countInput, { target: { value: "9" } });
    expect(await screen.findByText(HINT)).toBeInTheDocument();

    fireEvent.change(countInput, { target: { value: "10" } });
    await waitFor(() =>
      expect(screen.queryByText(HINT)).not.toBeInTheDocument()
    );
  });

  it("leaves the Count setting alone when rows are grouped", async () => {
    const countBy: CountBy = { field: "incident", incidentStatus: "active" };
    const onChange = await renderForm(tableWidget({ countBy }));

    await chooseGroupBy("Service");

    await waitFor(() =>
      expect(lastValue(onChange).alertTable).toEqual({
        groupBy: "service",
        emptyGroupPosition: "top",
      })
    );
    expect(lastValue(onChange).countBy).toEqual(countBy);
    expect(screen.getByRole("radio", { name: "Incidents" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("Alert Count Panel payload has no alertTable and shows no grouping controls", async () => {
    const onChange = await renderForm(
      savedWidget({
        alertTable: { columnOrder: ["name"], groupBy: "service" },
      })
    );

    expect(lastValue(onChange)).not.toHaveProperty("alertTable");
    expect(groupRowsBy()).toBeNull();
    expect(rowsWithNoValue()).toBeNull();
    expect(screen.queryByText("Group rows by")).not.toBeInTheDocument();
  });

  it("stops emitting alertTable and hides the controls when switching to Alert Count Panel", async () => {
    const onChange = await renderForm(
      tableWidget({ alertTable: { groupBy: "service" } })
    );
    expect(groupRowsBy()).not.toBeNull();

    await choosePanelType("Alert Count Panel");

    await waitFor(() =>
      expect(lastValue(onChange)).not.toHaveProperty("alertTable")
    );
    expect(groupRowsBy()).toBeNull();
    expect(rowsWithNoValue()).toBeNull();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });
});
