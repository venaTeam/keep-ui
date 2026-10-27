import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { CountByControl } from "../count-by-control";
import { CountBy } from "@/entities/presets/model/count-by";

const setup = (value?: CountBy) => {
  const onChange = jest.fn();
  const utils = render(<CountByControl value={value} onChange={onChange} />);
  return { onChange, ...utils };
};

const radio = (name: string) => screen.getByRole("radio", { name });

const choose = async (
  container: HTMLElement,
  dataCy: string,
  optionName: string
) => {
  const root = container.querySelector(`[data-cy="${dataCy}"]`) as HTMLElement;
  fireEvent.click(within(root).getByRole("button"));
  const listbox = await screen.findByRole("listbox");
  fireEvent.click(within(listbox).getByRole("option", { name: optionName }));
};

describe("CountByControl modes", () => {
  it("counts alerts by default and shows no extra controls", () => {
    setup(undefined);

    expect(radio("Alerts")).toHaveAttribute("aria-checked", "true");
    expect(radio("Incidents")).toHaveAttribute("aria-checked", "false");
    expect(radio("Other field")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText("Incident status")).toBeNull();
    expect(screen.queryByText("Field")).toBeNull();
  });

  it("selects incidents with the active status", () => {
    const { onChange } = setup(undefined);

    fireEvent.click(radio("Incidents"));

    expect(onChange).toHaveBeenCalledWith({
      field: "incident",
      incidentStatus: "active",
    });
  });

  it("selects the first other field", () => {
    const { onChange } = setup(undefined);

    fireEvent.click(radio("Other field"));

    expect(onChange).toHaveBeenCalledWith({ field: "name" });
  });

  it("goes back to counting alerts by clearing the setting", () => {
    const { onChange } = setup({ field: "incident", incidentStatus: "firing" });

    fireEvent.click(radio("Alerts"));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("does nothing when the selected mode is clicked again", () => {
    const { onChange } = setup({ field: "service" });

    fireEvent.click(radio("Other field"));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("CountByControl incidents", () => {
  const value: CountBy = { field: "incident", incidentStatus: "acknowledged" };

  it("explains what is counted and shows the current status", () => {
    const { container } = setup(value);

    expect(radio("Incidents")).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByText(
        "Distinct incidents with at least one alert matching the preset."
      )
    ).toBeInTheDocument();
    const statusRoot = container.querySelector(
      '[data-cy="dashboard-widget-form-incident-status-select"]'
    ) as HTMLElement;
    expect(within(statusRoot).getByRole("button")).toHaveTextContent(
      "Acknowledged only"
    );
  });

  it("defaults the displayed status to active", () => {
    const { container } = setup({ field: "incident" });

    const statusRoot = container.querySelector(
      '[data-cy="dashboard-widget-form-incident-status-select"]'
    ) as HTMLElement;
    expect(within(statusRoot).getByRole("button")).toHaveTextContent(
      "Active (firing + acknowledged)"
    );
  });

  it("changes the incident status", async () => {
    const { onChange, container } = setup(value);

    await choose(
      container,
      "dashboard-widget-form-incident-status-select",
      "Firing only"
    );

    expect(onChange).toHaveBeenCalledWith({
      field: "incident",
      incidentStatus: "firing",
    });
  });
});

describe("CountByControl other fields", () => {
  it("explains what is counted and shows the current field", () => {
    const { container } = setup({ field: "service" });

    expect(radio("Other field")).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByText(
        "Counts distinct values of that field. Empty values aren't counted."
      )
    ).toBeInTheDocument();
    const fieldRoot = container.querySelector(
      '[data-cy="dashboard-widget-form-count-field-select"]'
    ) as HTMLElement;
    expect(within(fieldRoot).getByRole("button")).toHaveTextContent("Service");
  });

  it("changes the field", async () => {
    const { onChange, container } = setup({ field: "service" });

    await choose(container, "dashboard-widget-form-count-field-select", "Site");

    expect(onChange).toHaveBeenCalledWith({ field: "site" });
  });

  it("offers exactly the allowlisted fields", async () => {
    const { container } = setup({ field: "name" });
    const fieldRoot = container.querySelector(
      '[data-cy="dashboard-widget-form-count-field-select"]'
    ) as HTMLElement;

    fireEvent.click(within(fieldRoot).getByRole("button"));
    const listbox = await screen.findByRole("listbox");

    expect(
      within(listbox)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual([
      "Alert name",
      "Service",
      "Host",
      "Application",
      "Site",
      "Assignee",
    ]);
  });
});
