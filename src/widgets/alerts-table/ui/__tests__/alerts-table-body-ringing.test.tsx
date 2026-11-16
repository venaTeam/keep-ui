import React from "react";
import { render, within } from "@testing-library/react";
import { Table } from "@tremor/react";
import {
  ColumnDef,
  GroupingState,
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
  alert("ring-numeric", 5, "firing"),
  alert("resolved", "critical", "resolved"),
  alert("high", "high", "firing"),
  { ...alert("deleted", "critical", "firing"), deleted: true } as AlertDto,
];

const columns: ColumnDef<AlertDto>[] = [
  { id: "severity", accessorKey: "severity", cell: () => null },
  { id: "name", accessorKey: "name", cell: (c) => String(c.getValue()) },
  { id: "service", accessorKey: "service", cell: (c) => String(c.getValue()) },
];

function Harness({
  presetNoisy,
  grouping = [],
}: {
  presetNoisy?: boolean;
  grouping?: GroupingState;
}) {
  const table = useReactTable({
    data: alerts,
    columns,
    getRowId: (row) => row.fingerprint,
    state: { grouping },
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

const rowOf = (container: HTMLElement, fingerprint: string) =>
  container.querySelector(
    `[data-cy="alerts-row"][data-cy-id="${fingerprint}"]`
  ) as HTMLElement;

describe("AlertsTableBody ringing rows", () => {
  it("rings critical firing rows of a noisy preset, word or numeric severity", () => {
    const { container } = render(<Harness presetNoisy />);

    for (const fingerprint of ["ring", "ring-numeric"]) {
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

  it("leaves every other row as it was", () => {
    const { container } = render(<Harness presetNoisy />);

    for (const fingerprint of ["resolved", "high"]) {
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

  it("does not ring a deleted critical firing alert", () => {
    const { container } = render(<Harness presetNoisy />);
    const row = rowOf(container, "deleted");

    expect(row).not.toHaveAttribute("data-ringing");
    expect(row).not.toHaveClass(BLINK);
    expect(within(row).queryByText(RINGING_REASON)).toBeNull();
  });

  it.each([false, undefined])(
    "rings nothing when the preset's noisy flag is %s",
    (presetNoisy) => {
      const { container } = render(<Harness presetNoisy={presetNoisy} />);

      expect(container.querySelector("[data-ringing]")).toBeNull();
      expect(container.querySelector(".motion-safe\\:animate-missing-blink")).toBeNull();
      expect(container.querySelector(".\\!bg-inherit")).toBeNull();
      expect(container.querySelector(".sr-only")).toBeNull();
    }
  );

  it("rings grouped child rows too", () => {
    const { container } = render(
      <Harness presetNoisy grouping={["service"]} />
    );

    expect(
      container.querySelector('[data-cy="alerts-group-header"]')
    ).not.toBeNull();
    expect(rowOf(container, "ring")).toHaveAttribute("data-ringing", "true");
    expect(rowOf(container, "ring")).toHaveClass(BLINK);
    expect(rowOf(container, "ring-numeric")).toHaveAttribute(
      "data-ringing",
      "true"
    );
    expect(within(rowOf(container, "ring")).getByText(RINGING_REASON)).toBeInTheDocument();
    expect(rowOf(container, "high")).not.toHaveAttribute("data-ringing");
    expect(
      container.querySelector('[data-cy="alerts-group-header"]')
    ).not.toHaveAttribute("data-ringing");
  });

  it("starts each ringing row's pulse at the page's time zero", () => {
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
    try {
      const { container } = render(<Harness presetNoisy />);

      expect(synced).toContain(rowOf(container, "ring"));
      expect(synced).toContain(rowOf(container, "ring-numeric"));
      expect(synced).not.toContain(rowOf(container, "high"));
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
    }
  });
});
