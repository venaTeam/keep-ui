import React from "react";
import { format } from "util";
import { act, render, within } from "@testing-library/react";
import { Table } from "@tremor/react";
import {
  ColumnDef,
  GroupingState,
  RowSelectionState,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertsTableBody } from "@/widgets/alerts-table/ui/alerts-table-body";
import { AlertDto } from "@/entities/alerts/model/types";
import { RINGING_REASON } from "@/widgets/alerts-table/lib/alert-ringing";

const PULSE = "motion-safe:before:animate-ringing-pulse";
const OVERLAY = [
  "isolate",
  "before:absolute",
  "before:inset-0",
  "before:-z-10",
  "before:pointer-events-none",
  "before:bg-[color:var(--blink-row-tint)]",
  PULSE,
];
const SELECTED = "!bg-blue-200/50";
const LAST_VIEWED = "bg-orange-50";
const HOVER = "group-hover:bg-orange-100";
const KNOWN_NESTING = [
  "In HTML, <tr> cannot be a child of <div>.",
  "In HTML, <div> cannot be a child of <tbody>.",
];

const alert = (
  fingerprint: string,
  severity: unknown,
  status: string,
  service = "api"
) =>
  ({
    id: fingerprint,
    fingerprint,
    name: `alert-${fingerprint}`,
    severity,
    status,
    service,
  }) as unknown as AlertDto;

const alerts = [
  alert("ring", "critical", "firing"),
  alert("numeric", 5, "firing"),
  alert("upper-case", "CRITICAL", "FIRING"),
  alert("resolved", "critical", "resolved"),
  alert("high", "high", "firing"),
  { ...alert("deleted", "critical", "firing"), deleted: true } as AlertDto,
];

const columns: ColumnDef<AlertDto>[] = [
  {
    id: "severity",
    accessorKey: "severity",
    cell: () => <div data-testid="severity-mark" />,
  },
  { id: "name", accessorKey: "name", cell: (c) => String(c.getValue()) },
  { id: "service", accessorKey: "service", cell: (c) => String(c.getValue()) },
];

type HarnessProps = {
  presetNoisy?: boolean;
  grouping?: GroupingState;
  rowSelection?: RowSelectionState;
  lastViewedAlert?: string | null;
};

const NO_GROUPING: GroupingState = [];
const NO_SELECTION: RowSelectionState = {};

function Harness({
  presetNoisy,
  grouping = NO_GROUPING,
  rowSelection = NO_SELECTION,
  lastViewedAlert = null,
}: HarnessProps) {
  const table = useReactTable({
    data: alerts,
    columns,
    getRowId: (row) => row.fingerprint,
    enableRowSelection: true,
    state: { grouping, rowSelection },
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });
  return (
    <Table>
      <AlertsTableBody
        table={table}
        showSkeleton={false}
        theme={{}}
        onRowClick={jest.fn()}
        lastViewedAlert={lastViewedAlert}
        presetName="noisy"
        presetNoisy={presetNoisy}
      />
    </Table>
  );
}

const renderHarness = async (props: HarnessProps = {}) => {
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(<Harness {...props} />);
  });
  return result!;
};

const rowOf = (container: HTMLElement, fingerprint: string) =>
  container.querySelector(
    `[data-cy="alerts-row"][data-cy-id="${fingerprint}"]`
  ) as HTMLElement;

const cellsOf = (row: HTMLElement) =>
  Array.from(row.querySelectorAll("td")) as HTMLElement[];

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  const printError = console.error;
  jest.spyOn(console, "error").mockImplementation((...args) => {
    const message = format(...args);
    if (!KNOWN_NESTING.some((known) => message.startsWith(known))) {
      printError(...args);
    }
  });
});

afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
  jest.restoreAllMocks();
});

describe("AlertsTableBody ringing rows", () => {
  it("puts the pulse on an overlay behind every cell of the critical firing row", async () => {
    const { container } = await renderHarness({ presetNoisy: true });
    const row = rowOf(container, "ring");
    const cells = cellsOf(row);

    expect(row).toHaveAttribute("data-ringing", "true");
    expect(row.getAttribute("style")).toBeNull();
    expect(row.className).not.toMatch(/blink|pulse/);
    expect(within(row).getByText(RINGING_REASON)).toHaveClass("sr-only");
    cells.forEach((cell) => {
      expect(cell).toHaveClass(...OVERLAY);
      expect(cell).not.toHaveClass("!bg-inherit");
      expect(cell.style.getPropertyValue("--blink-row-tint")).not.toBe("");
    });
    expect(cells[0]).toHaveClass("before:border-l-2");
    expect(cells[cells.length - 1]).toHaveClass("before:border-r-2");
  });

  it("leaves every other row as it was", async () => {
    const { container } = await renderHarness({ presetNoisy: true });

    for (const fingerprint of ["resolved", "high", "numeric", "upper-case"]) {
      const row = rowOf(container, fingerprint);
      expect(row).not.toHaveAttribute("data-ringing");
      expect(row.getAttribute("style")).toBeNull();
      expect(within(row).queryByText(RINGING_REASON)).toBeNull();
      cellsOf(row).forEach((cell) => {
        expect(cell).not.toHaveClass(PULSE);
        expect(cell).not.toHaveClass("isolate");
        expect(cell.style.getPropertyValue("--blink-row-tint")).toBe("");
      });
    }
  });

  it("keeps the reason out of what autofit measures and out of copied text", async () => {
    const { container } = await renderHarness({ presetNoisy: true });
    const firstCell = cellsOf(rowOf(container, "ring"))[0];
    const reason = within(firstCell).getByText(RINGING_REASON);

    expect(firstCell.firstElementChild).toHaveAttribute(
      "data-testid",
      "severity-mark"
    );
    expect(firstCell.firstElementChild).not.toHaveTextContent(RINGING_REASON);
    expect(firstCell.lastElementChild).toBe(reason);
    expect(reason).toHaveClass("sr-only", "select-none");
  });

  it("does not ring a deleted critical firing alert", async () => {
    const { container } = await renderHarness({ presetNoisy: true });
    const row = rowOf(container, "deleted");

    expect(row).not.toHaveAttribute("data-ringing");
    cellsOf(row).forEach((cell) => expect(cell).not.toHaveClass(PULSE));
    expect(within(row).queryByText(RINGING_REASON)).toBeNull();
  });

  it.each([false, undefined])(
    "rings nothing when the preset's noisy flag is %s",
    async (presetNoisy) => {
      const { container } = await renderHarness({ presetNoisy });

      expect(container.querySelector("[data-ringing]")).toBeNull();
      expect(
        container.querySelector(".motion-safe\\:before\\:animate-ringing-pulse")
      ).toBeNull();
      expect(container.querySelector(".sr-only")).toBeNull();
    }
  );

  it("keeps the last-viewed highlight and the hover on a ringing row", async () => {
    const { container } = await renderHarness({
      presetNoisy: true,
      lastViewedAlert: "ring",
    });
    const row = rowOf(container, "ring");

    expect(row).toHaveAttribute("data-ringing", "true");
    expect(row).toHaveClass(LAST_VIEWED, "hover:bg-orange-100");
    cellsOf(row).forEach((cell) => {
      expect(cell).toHaveClass(LAST_VIEWED, HOVER, PULSE);
      expect(cell).not.toHaveClass("bg-tremor-background");
    });
  });

  it("keeps the selection tint on a selected ringing row", async () => {
    const { container } = await renderHarness({
      presetNoisy: true,
      rowSelection: { ring: true, high: true },
    });
    const ringing = rowOf(container, "ring");

    expect(ringing).toHaveAttribute("data-ringing", "true");
    expect(ringing).toHaveClass(SELECTED);
    cellsOf(ringing).forEach((cell) => expect(cell).toHaveClass(PULSE));
    expect(rowOf(container, "high")).toHaveClass(SELECTED);
  });

  it("rings grouped child rows too", async () => {
    const { container } = await renderHarness({
      presetNoisy: true,
      grouping: ["service"],
    });
    const row = rowOf(container, "ring");

    expect(
      container.querySelector('[data-cy="alerts-group-header"]')
    ).not.toBeNull();
    expect(row).toHaveAttribute("data-ringing", "true");
    cellsOf(row).forEach((cell) => expect(cell).toHaveClass(...OVERLAY));
    expect(cellsOf(row)[0].lastElementChild).toHaveTextContent(RINGING_REASON);
    expect(rowOf(container, "high")).not.toHaveAttribute("data-ringing");
    expect(rowOf(container, "numeric")).not.toHaveAttribute("data-ringing");
  });

  it("starts the pulse of every ringing cell at the page's time zero", async () => {
    const synced: Element[] = [];
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: function (this: HTMLElement) {
        const element = this;
        return [
          {
            effect: { target: element, pseudoElement: "::before" },
            set startTime(value: number) {
              if (value === 0) {
                synced.push(element);
              }
            },
          },
        ];
      },
    });
    const { container } = await renderHarness({ presetNoisy: true });

    expect(synced).toEqual(
      expect.arrayContaining(cellsOf(rowOf(container, "ring")))
    );
    cellsOf(rowOf(container, "high")).forEach((cell) =>
      expect(synced).not.toContain(cell)
    );
  });
});
