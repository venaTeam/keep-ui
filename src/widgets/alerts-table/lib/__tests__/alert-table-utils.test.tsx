import React from "react";
import { render, screen } from "@testing-library/react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertDto } from "@/entities/alerts/model";
import { useAlertTableCols } from "@/widgets/alerts-table/lib/alert-table-utils";

jest.mock("@/utils/hooks/useProviders", () => ({
  useProviders: jest.fn(() => ({ data: undefined })),
}));

const DATE_COLUMN = "firingStartTime";
const GENERATED_COLUMNS = [DATE_COLUMN];

/**
 * Renders only the generated firingStartTime cell of a one-row table built
 * from useAlertTableCols, the same builder the presets, incident alerts and
 * alert history tables use.
 */
function FiringStartTimeCell({
  value,
  meta,
}: {
  value: unknown;
  meta?: Record<string, unknown>;
}) {
  const columns = useAlertTableCols({
    additionalColsToGenerate: GENERATED_COLUMNS,
    presetName: "null-dates-test",
  });
  const table = useReactTable({
    data: [{ fingerprint: "fp-1", [DATE_COLUMN]: value } as unknown as AlertDto],
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta,
  });
  const cell = table
    .getRowModel()
    .rows[0].getAllCells()
    .find((c) => c.column.id === DATE_COLUMN)!;
  return (
    <div data-testid="cell">
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </div>
  );
}

describe("useAlertTableCols generated date column", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["an unparseable string", "not-a-date"],
  ])("renders an empty cell for %s", (_label, value) => {
    render(<FiringStartTimeCell value={value} />);

    expect(screen.getByTestId("cell")).toBeEmptyDOMElement();
  });

  it("renders an empty cell for null when the column format is iso", () => {
    render(
      <FiringStartTimeCell
        value={null}
        meta={{ columnTimeFormats: { [DATE_COLUMN]: "iso" } }}
      />
    );

    expect(screen.getByTestId("cell")).toBeEmptyDOMElement();
  });

  it("renders a valid ISO string as time-ago with the ISO title", () => {
    render(<FiringStartTimeCell value="2025-01-15T08:30:00.000Z" />);

    const span = screen.getByTestId("cell").firstElementChild;
    expect(span?.tagName).toBe("SPAN");
    expect(span).toHaveAttribute("title", "2025-01-15T08:30:00.000Z");
    expect(span?.querySelector("time")).toHaveAttribute(
      "dateTime",
      "2025-01-15T08:30:00.000Z"
    );
    expect(span).toHaveTextContent(/ago$/);
  });

  it("renders a valid ISO string verbatim when the column format is iso", () => {
    render(
      <FiringStartTimeCell
        value="2025-01-15T08:30:00.000Z"
        meta={{ columnTimeFormats: { [DATE_COLUMN]: "iso" } }}
      />
    );

    const span = screen.getByTestId("cell").firstElementChild;
    expect(span).toHaveAttribute("title", "2025-01-15T08:30:00.000Z");
    expect(span?.textContent).toBe("2025-01-15T08:30:00.000Z");
  });
});
