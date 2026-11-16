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

const BLINK = "motion-safe:animate-missing-blink";
const STEADY = "motion-reduce:bg-[color:var(--blink-soft)]";
const SELECTED = "!bg-blue-200/50";
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
  { id: "severity", accessorKey: "severity", cell: () => null },
  { id: "name", accessorKey: "name", cell: (c) => String(c.getValue()) },
  { id: "service", accessorKey: "service", cell: (c) => String(c.getValue()) },
];

type HarnessProps = {
  presetNoisy?: boolean;
  grouping?: GroupingState;
  rowSelection?: RowSelectionState;
};

const NO_GROUPING: GroupingState = [];
const NO_SELECTION: RowSelectionState = {};

function Harness({
  presetNoisy,
  grouping = NO_GROUPING,
  rowSelection = NO_SELECTION,
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
        lastViewedAlert={null}
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
  it("rings the critical firing row of a noisy preset", async () => {
    const { container } = await renderHarness({ presetNoisy: true });

    for (const fingerprint of ["ring"]) {
      const row = rowOf(container, fingerprint);
      expect(row).toHaveAttribute("data-ringing", "true");
      expect(row).toHaveClass(BLINK, STEADY);
      expect(row.style.getPropertyValue("--blink-strong")).not.toBe("");
      expect(within(row).getByText(RINGING_REASON)).toHaveClass("sr-only");
      row
        .querySelectorAll("td")
        .forEach((cell) => expect(cell).toHaveClass("!bg-inherit"));
    }
  });

  it("leaves every other row as it was", async () => {
    const { container } = await renderHarness({ presetNoisy: true });

    for (const fingerprint of ["resolved", "high", "numeric", "upper-case"]) {
      const row = rowOf(container, fingerprint);
      expect(row).not.toHaveAttribute("data-ringing");
      expect(row).not.toHaveClass(BLINK);
      expect(row.getAttribute("style")).toBeNull();
      expect(within(row).queryByText(RINGING_REASON)).toBeNull();
      row
        .querySelectorAll("td")
        .forEach((cell) => expect(cell).not.toHaveClass("!bg-inherit"));
    }
  });

  it("does not ring a deleted critical firing alert", async () => {
    const { container } = await renderHarness({ presetNoisy: true });
    const row = rowOf(container, "deleted");

    expect(row).not.toHaveAttribute("data-ringing");
    expect(row).not.toHaveClass(BLINK);
    expect(within(row).queryByText(RINGING_REASON)).toBeNull();
  });

  it.each([false, undefined])(
    "rings nothing when the preset's noisy flag is %s",
    async (presetNoisy) => {
      const { container } = await renderHarness({ presetNoisy });

      expect(container.querySelector("[data-ringing]")).toBeNull();
      expect(container.querySelector(".motion-safe\\:animate-missing-blink")).toBeNull();
      expect(container.querySelector(".\\!bg-inherit")).toBeNull();
      expect(container.querySelector(".sr-only")).toBeNull();
    }
  );

  it("keeps the pulse on a selected ringing row instead of the selection tint", async () => {
    const { container } = await renderHarness({
      presetNoisy: true,
      rowSelection: { ring: true, high: true },
    });
    const ringing = rowOf(container, "ring");

    expect(ringing).toHaveAttribute("data-ringing", "true");
    expect(ringing).toHaveClass(BLINK, STEADY);
    expect(ringing).not.toHaveClass(SELECTED);
    expect(rowOf(container, "high")).toHaveClass(SELECTED);
  });

  it("rings grouped child rows too", async () => {
    const { container } = await renderHarness({
      presetNoisy: true,
      grouping: ["service"],
    });

    expect(
      container.querySelector('[data-cy="alerts-group-header"]')
    ).not.toBeNull();
    expect(rowOf(container, "ring")).toHaveAttribute("data-ringing", "true");
    expect(rowOf(container, "ring")).toHaveClass(BLINK);
    expect(rowOf(container, "numeric")).not.toHaveAttribute("data-ringing");
    expect(within(rowOf(container, "ring")).getByText(RINGING_REASON)).toBeInTheDocument();
    expect(rowOf(container, "high")).not.toHaveAttribute("data-ringing");
    expect(
      container.querySelector('[data-cy="alerts-group-header"]')
    ).not.toHaveAttribute("data-ringing");
  });

  it("starts each ringing row's pulse at the page's time zero", async () => {
    const synced: Element[] = [];
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: function (this: HTMLElement) {
        const element = this;
        return [
          {
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

    expect(synced).toContain(rowOf(container, "ring"));
    expect(synced).not.toContain(rowOf(container, "high"));
  });
});
