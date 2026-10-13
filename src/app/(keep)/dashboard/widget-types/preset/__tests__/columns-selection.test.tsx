import React from "react";
import { render, screen, within } from "@testing-library/react";
import { useFacetPotentialFields } from "@/features/filter/hooks";
import ColumnsSelection from "../columns-selection";

jest.mock("@/features/filter/hooks", () => ({
  useFacetPotentialFields: jest.fn(),
}));

function mockFacetFields(data: string[] | undefined) {
  (useFacetPotentialFields as jest.Mock).mockReturnValue({ data });
}

function renderSelection(selectedColumns?: string[]) {
  return render(
    <ColumnsSelection selectedColumns={selectedColumns} onChange={jest.fn()} />
  );
}

function selectedChip(text: string) {
  const trigger = screen
    .getAllByRole("button")
    .find((button) => button.getAttribute("aria-haspopup") === "listbox")!;
  return within(trigger).queryByText(text);
}

describe("ColumnsSelection", () => {
  it("shows the saved columns when the tenant has no alert fields", () => {
    mockFacetFields([]);

    renderSelection(["name", "labels.team"]);

    expect(selectedChip("name")).toBeInTheDocument();
    expect(selectedChip("labels.team")).toBeInTheDocument();
  });

  it("shows a saved column that is missing from the fetched fields", () => {
    mockFacetFields(["name", "status"]);

    renderSelection(["name", "labels.team"]);

    expect(selectedChip("labels.team")).toBeInTheDocument();
  });

  it("shows the saved columns while the fields are still loading", () => {
    mockFacetFields(undefined);

    renderSelection(["name"]);

    expect(selectedChip("name")).toBeInTheDocument();
  });

  it("lists a saved column once when it is also a fetched field", () => {
    mockFacetFields(["name", "severity"]);

    const { container } = renderSelection(["name"]);

    const options = Array.from(
      container.querySelectorAll('select[title="multi-select-hidden"] option')
    ).filter((option) => option.textContent === "name");
    expect(options).toHaveLength(1);
  });
});
