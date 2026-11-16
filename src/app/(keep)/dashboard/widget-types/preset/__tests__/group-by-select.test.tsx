import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { GROUP_BY_SHORTLIST_LABELS } from "@/widgets/alerts-table/lib/alert-column-options";
import { GroupBySelect } from "../group-by-select";

const FIELDS = ["labels.region", "labels.team", "name", "service", "status"];

type Props = React.ComponentProps<typeof GroupBySelect>;

const setup = (props: Partial<Props> = {}) => {
  const onChange = jest.fn();
  const utils = render(
    <GroupBySelect
      value={null}
      onChange={onChange}
      fieldOptions={FIELDS}
      {...props}
    />
  );
  return { onChange, ...utils };
};

const input = () => screen.getByRole("combobox", { name: "Group rows by" });

const open = async () => {
  fireEvent.click(
    screen.getByRole("button", { name: "Show Group rows by options" })
  );
  return screen.findByRole("listbox");
};

const choose = (listbox: HTMLElement, name: string) =>
  fireEvent.mouseDown(within(listbox).getByRole("option", { name }));

const optionTexts = (listbox: HTMLElement) =>
  within(listbox)
    .getAllByRole("option")
    .map((option) => option.textContent);

describe("GroupBySelect", () => {
  it("lists None, then Incident first in the shortlist", async () => {
    setup();

    const listbox = await open();

    expect(optionTexts(listbox)).toEqual([
      "None",
      "Incident",
      "Alert name",
      "Service",
      "Host",
      "Application",
      "Site",
      "Assignee",
      "Source",
      "Status",
      "labels.region",
      "labels.team",
    ]);
  });

  it("puts a divider and the 'Any other field…' heading before the other fields", async () => {
    setup();

    const listbox = await open();

    expect(within(listbox).queryByRole("separator")).toBeNull();
    const divider = listbox.querySelector(
      '[data-cy="group-by-select-divider"]'
    );
    expect(divider).toHaveAttribute("role", "presentation");
    expect(divider).toHaveAttribute("aria-hidden", "true");
    const others = within(listbox).getByRole("group", {
      name: "Any other field…",
    });
    expect(
      within(others)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["labels.region", "labels.team"]);
  });

  it("choosing Incident calls onChange('incident'); None calls onChange(null)", async () => {
    const { onChange } = setup({ value: "service" });

    choose(await open(), "Incident");
    expect(onChange).toHaveBeenLastCalledWith("incident");

    choose(await open(), "None");
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("ArrowDown and Enter pick an option from the keyboard", async () => {
    const { onChange } = setup();

    act(() => input().focus());
    await screen.findByRole("listbox");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("incident");
  });

  it("typing after a click on the box searches instead of adding to 'None'", async () => {
    setup();
    const field = input() as HTMLInputElement;

    act(() => field.focus());
    fireEvent.mouseDown(field);
    fireEvent.mouseUp(field);
    fireEvent.click(field);
    await screen.findByRole("listbox");
    fireEvent.change(field, { target: { value: `${field.value}serv` } });

    expect(field).toHaveValue("serv");
    expect(optionTexts(await screen.findByRole("listbox"))).toEqual([
      "Service",
    ]);
  });

  it("shows only the search text while open and the chosen label once closed", async () => {
    setup({ value: "service" });
    const field = input() as HTMLInputElement;
    expect(field).toHaveValue("Service");

    act(() => field.focus());
    await screen.findByRole("listbox");
    expect(field).toHaveValue("");

    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(field).toHaveValue("Service");
  });

  it("takes its labels from the shared shortlist", () => {
    setup({ value: "site" });

    expect(input()).toHaveValue(GROUP_BY_SHORTLIST_LABELS.get("site"));
  });

  it("searching shows matching non-shortlist fields", async () => {
    const { onChange } = setup();

    await open();
    fireEvent.change(input(), { target: { value: "region" } });

    const listbox = await screen.findByRole("listbox");
    expect(optionTexts(listbox)).toEqual(["labels.region"]);

    choose(listbox, "labels.region");
    expect(onChange).toHaveBeenLastCalledWith("labels.region");
  });

  it("reopening after a search lists every option again", async () => {
    setup();

    await open();
    fireEvent.change(input(), { target: { value: "region" } });
    choose(await screen.findByRole("listbox"), "labels.region");

    expect(optionTexts(await open())).toHaveLength(12);
  });

  it("searching also matches shortlist labels", async () => {
    setup();

    await open();
    fireEvent.change(input(), { target: { value: "host" } });

    expect(optionTexts(await screen.findByRole("listbox"))).toEqual(["Host"]);
  });

  it("says so when nothing matches", async () => {
    setup();

    await open();
    fireEvent.change(input(), { target: { value: "zzz" } });

    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).queryAllByRole("option")).toHaveLength(0);
    expect(within(listbox).getByText("No matching fields")).toBeInTheDocument();
  });

  it("clearing the search text does not change the value", async () => {
    const { onChange } = setup({ value: "service" });

    await open();
    fireEvent.change(input(), { target: { value: "reg" } });
    fireEvent.change(input(), { target: { value: "" } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows None, a shortlist label or the field id as the current value", () => {
    const { rerender, onChange } = setup();
    expect(input()).toHaveValue("None");

    rerender(
      <GroupBySelect
        value="node_name"
        onChange={onChange}
        fieldOptions={FIELDS}
      />
    );
    expect(input()).toHaveValue("Host");

    rerender(
      <GroupBySelect
        value="labels.team"
        onChange={onChange}
        fieldOptions={FIELDS}
      />
    );
    expect(input()).toHaveValue("labels.team");
  });

  it("keeps a saved field that is not among the options selectable", async () => {
    setup({ value: "labels.gone", fieldOptions: [] });

    expect(input()).toHaveValue("labels.gone");
    const listbox = await open();
    expect(
      within(listbox).getByRole("option", { name: "labels.gone" })
    ).toHaveAttribute("aria-selected", "true");
  });

  it("marks its root for the widget form by default", () => {
    const { container } = setup();

    expect(
      container.querySelector('[data-cy="dashboard-widget-form-group-rows-by"]')
    ).toContainElement(input());
  });

  it("uses a passed data-testid for both test attributes", () => {
    const { container } = setup({ "data-testid": "widget-table-group-by" });

    const root = screen.getByTestId("widget-table-group-by");
    expect(root).toHaveAttribute("data-cy", "widget-table-group-by");
    expect(
      container.querySelector('[data-cy="dashboard-widget-form-group-rows-by"]')
    ).toBeNull();
  });

  it("uses a passed data-cy", () => {
    const { container } = setup({ "data-cy": "panel-group-rows-by" });

    expect(
      container.querySelector('[data-cy="panel-group-rows-by"]')
    ).toContainElement(input());
  });

  it("never shows the words 'Group by'", async () => {
    setup();

    await open();

    expect(document.body.textContent).not.toMatch(/group by/i);
    expect(input()).toHaveAttribute("placeholder", "Group rows by");
  });
});
