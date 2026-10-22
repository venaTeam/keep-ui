import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useFacetPotentialFields } from "@/features/filter/hooks";
import ColumnsSelection from "../columns-selection";

jest.mock("@/features/filter/hooks", () => ({
  useFacetPotentialFields: jest.fn(),
}));

function mockFacetFields(data: string[] | undefined) {
  (useFacetPotentialFields as jest.Mock).mockReturnValue({ data });
}

function renderSelection(selectedColumns?: string[]) {
  const onChange = jest.fn();
  render(
    <ColumnsSelection selectedColumns={selectedColumns} onChange={onChange} />
  );
  return onChange;
}

async function openDropdown() {
  fireEvent.click(screen.getByRole("button", { expanded: false }));
  return within(await screen.findByRole("listbox"));
}

function lastSelection(onChange: jest.Mock): string[] {
  return [...onChange.mock.lastCall![0]].sort();
}

describe("ColumnsSelection", () => {
  it("shows the saved columns when the tenant has no alert fields", () => {
    mockFacetFields([]);

    renderSelection(["name", "labels.team"]);

    const trigger = screen.getByRole("button", { expanded: false });
    expect(trigger).toHaveAccessibleName(/labels\.team/);
    expect(trigger).toHaveAccessibleName(/name/);
  });

  it("shows a saved column that is missing from the fetched fields", () => {
    mockFacetFields(["name", "status"]);

    renderSelection(["name", "labels.team"]);

    expect(
      screen.getByRole("button", { name: /labels\.team/ })
    ).toBeInTheDocument();
  });

  it("shows the saved columns while the fields are still loading", () => {
    mockFacetFields(undefined);

    renderSelection(["name"]);

    expect(screen.getByRole("button", { name: "name" })).toBeInTheDocument();
  });

  it("lists a saved column once when it is also a fetched field", async () => {
    mockFacetFields(["name", "severity"]);

    renderSelection(["name"]);

    const listbox = await openDropdown();
    expect(listbox.getAllByRole("option", { name: "name" })).toHaveLength(1);
  });

  it("keeps a deselected saved column in the options so it can be selected again", async () => {
    mockFacetFields([]);

    const onChange = renderSelection(["name", "labels.team"]);
    const listbox = await openDropdown();

    fireEvent.click(
      listbox.getByRole("option", { name: "name", selected: true })
    );

    expect(lastSelection(onChange)).toEqual(["labels.team"]);
    fireEvent.click(
      listbox.getByRole("option", { name: "name", selected: false })
    );

    expect(lastSelection(onChange)).toEqual(["labels.team", "name"]);
  });
});
