import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { WidgetData, WidgetType } from "../../../types";
import { DEFAULT_INCIDENT_TABLE_CONFIG } from "../incident-table-config";
import { IncidentTableWidgetForm } from "../incident-table-widget-form";

const STATUSES_LABEL = "Incident statuses to display";
const SEVERITIES_LABEL = "Incident severities to display";
const COLUMNS_LABEL = "Columns";
const LIMIT_LABEL = "Max incidents to show";

function lastCall(onChange: jest.Mock) {
  return onChange.mock.calls[onChange.mock.calls.length - 1];
}

async function openMultiSelect(label: string) {
  fireEvent.click(
    within(screen.getByLabelText(label)).getByRole("button", {
      expanded: false,
    })
  );
  return within(await screen.findByRole("listbox"));
}

describe("IncidentTableWidgetForm", () => {
  it("emits the defaults and the new-widget layout", () => {
    const onChange = jest.fn();
    render(<IncidentTableWidgetForm onChange={onChange} />);

    expect(lastCall(onChange)).toEqual([
      {
        w: 16,
        h: 11,
        minW: 0,
        minH: 2,
        static: false,
        incidentTable: DEFAULT_INCIDENT_TABLE_CONFIG,
      },
      true,
    ]);
  });

  it("pre-fills from the edited widget and emits no layout", () => {
    const incidentTable = {
      statuses: ["suppressed" as const],
      severities: ["critical" as const],
      columns: ["name" as const],
      limit: 5,
    };
    const editingItem = {
      i: "w-1",
      name: "Open incidents",
      widgetType: WidgetType.INCIDENT_TABLE,
      incidentTable,
    } as unknown as WidgetData;
    const onChange = jest.fn();
    render(
      <IncidentTableWidgetForm editingItem={editingItem} onChange={onChange} />
    );

    const [value, isValid] = lastCall(onChange);
    expect(isValid).toBe(true);
    expect(value).toEqual({ incidentTable });
    expect(value).not.toHaveProperty("w");
    expect(screen.getByLabelText(LIMIT_LABEL)).toHaveValue(5);
  });

  it("falls back to defaults when the edited widget has no incidentTable", () => {
    const editingItem = {
      i: "w-1",
      name: "Alerts",
      widgetType: WidgetType.PRESET,
    } as unknown as WidgetData;
    const onChange = jest.fn();
    render(
      <IncidentTableWidgetForm editingItem={editingItem} onChange={onChange} />
    );

    const [value, isValid] = lastCall(onChange);
    expect(isValid).toBe(true);
    expect(value.incidentTable).toEqual(DEFAULT_INCIDENT_TABLE_CONFIG);
    expect(value).not.toHaveProperty("w");
  });

  it("emits the new limit as a number", () => {
    const onChange = jest.fn();
    render(<IncidentTableWidgetForm onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(LIMIT_LABEL), {
      target: { value: "25" },
    });

    const [value, isValid] = lastCall(onChange);
    expect(isValid).toBe(true);
    expect(value.incidentTable.limit).toBe(25);
  });

  it("rejects an out-of-range limit", () => {
    const onChange = jest.fn();
    render(<IncidentTableWidgetForm onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(LIMIT_LABEL), {
      target: { value: "0" },
    });

    expect(lastCall(onChange)[1]).toBe(false);
    expect(
      screen.getByText("Enter a whole number from 1 to 50")
    ).toBeInTheDocument();
  });

  it("rejects an empty status selection", async () => {
    const onChange = jest.fn();
    render(<IncidentTableWidgetForm onChange={onChange} />);

    const listbox = await openMultiSelect(STATUSES_LABEL);
    for (const name of ["Firing", "Acknowledged", "Suppressed"]) {
      fireEvent.click(listbox.getByRole("option", { name, selected: true }));
    }

    const [value, isValid] = lastCall(onChange);
    expect(isValid).toBe(false);
    expect(value.incidentTable.statuses).toEqual([]);
    expect(screen.getByText("Select at least one status")).toBeInTheDocument();
  });

  it("keeps severities in their fixed order when one is ticked again", async () => {
    const onChange = jest.fn();
    render(<IncidentTableWidgetForm onChange={onChange} />);

    const severities = await openMultiSelect(SEVERITIES_LABEL);
    fireEvent.click(
      severities.getByRole("option", { name: "Critical", selected: true })
    );
    fireEvent.click(
      severities.getByRole("option", { name: "Critical", selected: false })
    );
    expect(lastCall(onChange)[0].incidentTable.severities).toEqual([
      "critical",
      "high",
      "warning",
    ]);
  });

  it("lists only the three statuses and three severities", async () => {
    const statuses = render(<IncidentTableWidgetForm onChange={jest.fn()} />);
    const statusListbox = await openMultiSelect(STATUSES_LABEL);
    expect(
      statusListbox.getAllByRole("option").map((option) => option.textContent)
    ).toEqual(["Firing", "Acknowledged", "Suppressed"]);
    statuses.unmount();

    render(<IncidentTableWidgetForm onChange={jest.fn()} />);
    const severityListbox = await openMultiSelect(SEVERITIES_LABEL);
    expect(
      severityListbox.getAllByRole("option").map((option) => option.textContent)
    ).toEqual(["Critical", "High", "Warning"]);
  });

  it("offers the columns by their table header and emits the rest in table order", async () => {
    const onChange = jest.fn();
    render(<IncidentTableWidgetForm onChange={onChange} />);

    const listbox = await openMultiSelect(COLUMNS_LABEL);
    expect(
      listbox.getAllByRole("option").map((option) => option.textContent)
    ).toEqual([
      "Status",
      "Severity",
      "Name",
      "Description",
      "Alerts",
      "Created",
      "SN Link",
    ]);

    fireEvent.click(listbox.getByRole("option", { name: "Name" }));
    expect(lastCall(onChange)[0].incidentTable.columns).toEqual([
      "status",
      "severity",
      "description",
      "alertsCount",
      "creationTime",
      "snLink",
    ]);
  });
});
