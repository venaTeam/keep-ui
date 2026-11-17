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

describe("CountByControl missing alerts toggle", () => {
  const toggleRoot = (container: HTMLElement) =>
    container.querySelector(
      '[data-cy="dashboard-widget-form-count-missing"]'
    ) as HTMLElement | null;

  const toggle = (container: HTMLElement) =>
    within(toggleRoot(container) as HTMLElement).getByRole("switch");

  it("is not offered when counting alerts", () => {
    const { container } = setup(undefined);

    expect(toggleRoot(container)).toBeNull();
  });

  it("is labelled for incidents and off by default", () => {
    const { container } = setup({ field: "incident", incidentStatus: "active" });

    expect(screen.getByText("Show alerts not in an incident")).toBeInTheDocument();
    expect(
      screen.getByText("Adds how many matching alerts aren't in any incident.")
    ).toBeInTheDocument();
    expect(toggle(container)).toHaveAttribute("aria-checked", "false");
  });

  it("is labelled for the chosen field", () => {
    setup({ field: "service" });

    expect(screen.getByText("Show alerts with no service")).toBeInTheDocument();
  });

  it("shows a saved toggle as on", () => {
    const { container } = setup({ field: "service", showMissing: true });

    expect(toggle(container)).toHaveAttribute("aria-checked", "true");
  });

  it("turns the toggle on", () => {
    const { onChange, container } = setup({
      field: "incident",
      incidentStatus: "active",
    });

    fireEvent.click(toggle(container));

    expect(onChange).toHaveBeenCalledWith({
      field: "incident",
      incidentStatus: "active",
      showMissing: true,
    });
  });

  it("turns the toggle off", () => {
    const { onChange, container } = setup({
      field: "service",
      showMissing: true,
    });

    fireEvent.click(toggle(container));

    expect(onChange).toHaveBeenCalledWith({
      field: "service",
      showMissing: false,
    });
  });

  it("keeps the toggle when the incident status changes", async () => {
    const { onChange, container } = setup({
      field: "incident",
      incidentStatus: "active",
      showMissing: true,
    });

    await choose(
      container,
      "dashboard-widget-form-incident-status-select",
      "Firing only"
    );

    expect(onChange).toHaveBeenCalledWith({
      field: "incident",
      incidentStatus: "firing",
      showMissing: true,
    });
  });

  it("keeps the toggle when the field changes", async () => {
    const { onChange, container } = setup({
      field: "service",
      showMissing: true,
    });

    await choose(container, "dashboard-widget-form-count-field-select", "Host");

    expect(onChange).toHaveBeenCalledWith({
      field: "node_name",
      showMissing: true,
    });
  });

  it("keeps the toggle between incidents and another field", () => {
    const { onChange } = setup({
      field: "incident",
      incidentStatus: "active",
      showMissing: true,
    });

    fireEvent.click(radio("Other field"));

    expect(onChange).toHaveBeenCalledWith({ field: "name", showMissing: true });
  });

  it("does not carry the toggle into an alerts count", () => {
    const { onChange } = setup({ field: "service", showMissing: true });

    fireEvent.click(radio("Alerts"));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe("CountByControl blink toggle", () => {
  const blinkRoot = (container: HTMLElement) =>
    container.querySelector(
      '[data-cy="dashboard-widget-form-count-missing-blink"]'
    ) as HTMLElement | null;

  const blinkSwitch = (container: HTMLElement) =>
    within(blinkRoot(container) as HTMLElement).getByRole("switch");

  const incidentsWithMissing: CountBy = {
    field: "incident",
    incidentStatus: "active",
    showMissing: true,
  };

  it("is not offered while the left-out alerts are hidden", () => {
    const { container } = setup({ field: "incident", incidentStatus: "active" });

    expect(blinkRoot(container)).toBeNull();
  });

  it("is not offered when counting alerts", () => {
    const { container } = setup(undefined);

    expect(blinkRoot(container)).toBeNull();
  });

  it("is labelled and off by default once the left-out alerts are shown", () => {
    const { container } = setup(incidentsWithMissing);

    expect(screen.getByText("Make it blink")).toBeInTheDocument();
    expect(
      screen.getByText("While any alert isn't in an incident.")
    ).toBeInTheDocument();
    expect(blinkSwitch(container)).toHaveAttribute("aria-checked", "false");
  });

  it("explains the blink for the chosen field", () => {
    setup({ field: "service", showMissing: true });

    expect(
      screen.getByText("While any alert has no service.")
    ).toBeInTheDocument();
  });

  it("shows a saved blink as on", () => {
    const { container } = setup({ ...incidentsWithMissing, blinkMissing: true });

    expect(blinkSwitch(container)).toHaveAttribute("aria-checked", "true");
  });

  it("turns the blink on", () => {
    const { onChange, container } = setup(incidentsWithMissing);

    fireEvent.click(blinkSwitch(container));

    expect(onChange).toHaveBeenCalledWith({
      ...incidentsWithMissing,
      blinkMissing: true,
    });
  });

  it("turns the blink off", () => {
    const { onChange, container } = setup({
      ...incidentsWithMissing,
      blinkMissing: true,
    });

    fireEvent.click(blinkSwitch(container));

    expect(onChange).toHaveBeenCalledWith({
      ...incidentsWithMissing,
      blinkMissing: false,
    });
  });

  it("keeps the blink when the incident status changes", async () => {
    const { onChange, container } = setup({
      ...incidentsWithMissing,
      blinkMissing: true,
    });

    await choose(
      container,
      "dashboard-widget-form-incident-status-select",
      "Firing only"
    );

    expect(onChange).toHaveBeenCalledWith({
      field: "incident",
      incidentStatus: "firing",
      showMissing: true,
      blinkMissing: true,
    });
  });

  it("keeps the blink when the field changes", async () => {
    const { onChange, container } = setup({
      field: "service",
      showMissing: true,
      blinkMissing: true,
    });

    await choose(container, "dashboard-widget-form-count-field-select", "Host");

    expect(onChange).toHaveBeenCalledWith({
      field: "node_name",
      showMissing: true,
      blinkMissing: true,
    });
  });

  it("keeps the blink between incidents and another field", () => {
    const { onChange } = setup({ ...incidentsWithMissing, blinkMissing: true });

    fireEvent.click(radio("Other field"));

    expect(onChange).toHaveBeenCalledWith({
      field: "name",
      showMissing: true,
      blinkMissing: true,
    });
  });

  it("does not carry the blink into an alerts count", () => {
    const { onChange } = setup({ ...incidentsWithMissing, blinkMissing: true });

    fireEvent.click(radio("Alerts"));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe("CountByControl blink color", () => {
  const colorInput = (container: HTMLElement) =>
    container.querySelector(
      '[data-cy="dashboard-widget-form-count-missing-blink-color"]'
    ) as HTMLInputElement | null;

  const blinking: CountBy = {
    field: "incident",
    incidentStatus: "active",
    showMissing: true,
    blinkMissing: true,
  };

  it("is offered only while the blink is on", () => {
    const { container } = setup({ ...blinking, blinkMissing: false });

    expect(colorInput(container)).toBeNull();
  });

  it("starts at red", () => {
    const { container } = setup(blinking);

    expect(colorInput(container)).toHaveValue("#dc2626");
    expect(colorInput(container)).toHaveAttribute("type", "color");
    expect(colorInput(container)).toHaveAccessibleName("Blink color");
  });

  it("shows a saved color", () => {
    const { container } = setup({ ...blinking, blinkColor: "#2563eb" });

    expect(colorInput(container)).toHaveValue("#2563eb");
  });

  it("saves the chosen color", () => {
    const { onChange, container } = setup(blinking);

    fireEvent.change(colorInput(container) as HTMLInputElement, {
      target: { value: "#16a34a" },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...blinking,
      blinkColor: "#16a34a",
    });
  });

  it("keeps the color when the incident status changes", async () => {
    const { onChange, container } = setup({
      ...blinking,
      blinkColor: "#2563eb",
    });

    await choose(
      container,
      "dashboard-widget-form-incident-status-select",
      "Firing only"
    );

    expect(onChange).toHaveBeenCalledWith({
      ...blinking,
      incidentStatus: "firing",
      blinkColor: "#2563eb",
    });
  });

  it("keeps the color between incidents and another field", () => {
    const { onChange } = setup({ ...blinking, blinkColor: "#2563eb" });

    fireEvent.click(radio("Other field"));

    expect(onChange).toHaveBeenCalledWith({
      field: "name",
      showMissing: true,
      blinkMissing: true,
      blinkColor: "#2563eb",
    });
  });

  it("does not carry the color into an alerts count", () => {
    const { onChange } = setup({ ...blinking, blinkColor: "#2563eb" });

    fireEvent.click(radio("Alerts"));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
