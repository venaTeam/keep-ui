import React from "react";
import { format } from "util";
import { act, render } from "@testing-library/react";
import { Table } from "@tremor/react";
import {
  ColumnDef,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertsTableBody } from "@/widgets/alerts-table/ui/alerts-table-body";
import { AlertDto } from "@/entities/alerts/model/types";

const KNOWN_NESTING = [
  "In HTML, <tr> cannot be a child of <div>.",
  "In HTML, <div> cannot be a child of <tbody>.",
];

const alerts = ["first", "second"].map(
  (fingerprint) =>
    ({
      id: fingerprint,
      fingerprint,
      name: fingerprint,
      severity: "high",
      status: "firing",
    }) as unknown as AlertDto
);

const columns: ColumnDef<AlertDto>[] = [
  { id: "severity", cell: () => null },
  { id: "checkbox", cell: () => null },
  { id: "status", accessorKey: "status", cell: () => null },
  { id: "source", cell: () => null },
  { id: "name", accessorKey: "name", cell: (c) => String(c.getValue()) },
  { id: "alertMenu", cell: () => null },
];

function Harness() {
  const table = useReactTable({
    data: alerts,
    columns,
    getRowId: (row) => row.fingerprint,
    state: {
      columnPinning: {
        left: ["severity", "checkbox", "status", "source"],
        right: ["alertMenu"],
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });
  return (
    <Table>
      <AlertsTableBody
        table={table}
        showSkeleton={false}
        theme={{}}
        onRowClick={jest.fn()}
        lastViewedAlert={null}
        presetName="feed"
      />
    </Table>
  );
}

const zIndexOf = (container: HTMLElement, row: string, column: string) =>
  Number(
    (
      container.querySelector(
        `[data-cy-id="${row}"] [data-column-id="${column}"]`
      ) as HTMLElement
    ).style.zIndex
  );

beforeEach(() => {
  const printError = console.error;
  jest.spyOn(console, "error").mockImplementation((...args) => {
    const message = format(...args);
    if (!KNOWN_NESTING.some((known) => message.startsWith(known))) {
      printError(...args);
    }
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("AlertsTableBody pinned cells", () => {
  it("does not stack a later row's pinned status cell below an earlier row's pinned checkbox and severity cells", async () => {
    let container: HTMLElement | undefined;
    await act(async () => {
      container = render(<Harness />).container;
    });

    const status = zIndexOf(container!, "second", "status");
    expect(status).toBeGreaterThanOrEqual(
      zIndexOf(container!, "first", "checkbox")
    );
    expect(status).toBeGreaterThanOrEqual(
      zIndexOf(container!, "first", "severity")
    );
  });

  it("keeps scrolled and right-pinned cells without a z-index", async () => {
    let container: HTMLElement | undefined;
    await act(async () => {
      container = render(<Harness />).container;
    });

    for (const column of ["name", "alertMenu"]) {
      expect(
        (
          container!.querySelector(
            `[data-cy-id="first"] [data-column-id="${column}"]`
          ) as HTMLElement
        ).style.zIndex
      ).toBe("");
    }
  });
});
