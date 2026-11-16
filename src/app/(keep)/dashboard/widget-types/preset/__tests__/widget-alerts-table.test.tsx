import React from "react";
import { render, screen } from "@testing-library/react";
import WidgetAlertsTable from "../widget-alerts-table";
import { RINGING_REASON } from "@/widgets/alerts-table/lib/alert-ringing";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("WidgetAlertsTable", () => {
  it("shows the payload value for a snake_case column named by the facet fields list", () => {
    const alerts = [
      { name: "disk-full", lastReceived: "2026-10-01T10:00:00Z" },
    ];

    render(
      <WidgetAlertsTable
        presetName="feed"
        alerts={alerts}
        columns={["name", "last_received"]}
      />
    );

    expect(screen.getByText("2026-10-01T10:00:00Z")).toBeInTheDocument();
  });
});

describe("WidgetAlertsTable ringing rows", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
  });

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
  });

  const PULSE = "motion-safe:before:animate-ringing-pulse";
  const OVERLAY = [
    "isolate",
    "[&:not(.sticky)]:relative",
    "before:absolute",
    "before:inset-0",
    "before:-z-10",
    "before:pointer-events-none",
    PULSE,
  ];
  const columns = ["status", "name", "description"];
  const alerts = [
    { name: "ring", severity: "critical", status: "firing" },
    { name: "quiet-resolved", severity: "critical", status: "resolved" },
    { name: "quiet-high", severity: "high", status: "firing" },
    {
      name: "quiet-deleted",
      severity: "critical",
      status: "firing",
      deleted: true,
    },
    { name: "quiet-numeric", severity: 5, status: "firing" },
    { name: "quiet-upper-case", severity: "CRITICAL", status: "FIRING" },
  ];

  const renderTable = (presetNoisy?: boolean) =>
    render(
      <WidgetAlertsTable
        presetName="noisy"
        alerts={alerts}
        columns={columns}
        presetNoisy={presetNoisy}
      />
    );

  const cellsOfRow = (container: HTMLElement, rowIndex: number) => {
    const grid = container.querySelector(
      '[data-cy="dashboard-widget-alerts-table"] > div'
    ) as HTMLElement;
    const cells = Array.from(grid.children).slice(columns.length);
    return cells.slice(
      rowIndex * columns.length,
      (rowIndex + 1) * columns.length
    ) as HTMLElement[];
  };

  it("puts the pulse on an overlay behind every cell of a critical firing row in a noisy preset", () => {
    const { container } = renderTable(true);

    for (const rowIndex of [0]) {
      const cells = cellsOfRow(container, rowIndex);
      expect(cells).toHaveLength(columns.length);
      cells.forEach((cell) => {
        expect(cell).toHaveClass(...OVERLAY);
        expect(cell).toHaveAttribute("data-ringing", "true");
        expect(cell.style.getPropertyValue("--blink-row-tint")).not.toBe("");
      });
      expect(cells[0]).toHaveClass("before:border-l-2");
      expect(cells[cells.length - 1]).toHaveClass("before:border-r-2");
      expect(cells[0]).toHaveTextContent(RINGING_REASON);
    }
    expect(screen.getAllByText(RINGING_REASON)).toHaveLength(1);
    screen
      .getAllByText(RINGING_REASON)
      .forEach((reason) => expect(reason).toHaveClass("sr-only"));
  });

  it("leaves the other rows as they were", () => {
    const { container } = renderTable(true);

    for (const rowIndex of [1, 2, 4, 5]) {
      cellsOfRow(container, rowIndex).forEach((cell) => {
        expect(cell).not.toHaveClass(PULSE);
        expect(cell).not.toHaveAttribute("data-ringing");
        expect(cell.getAttribute("style")).toBeNull();
      });
    }
  });

  it("does not ring a deleted critical firing alert", () => {
    const { container } = renderTable(true);

    cellsOfRow(container, 3).forEach((cell) => {
      expect(cell).not.toHaveClass(PULSE);
      expect(cell).not.toHaveAttribute("data-ringing");
    });
    expect(screen.getAllByText(RINGING_REASON)).toHaveLength(1);
  });

  it.each([false, undefined])(
    "rings nothing when the preset's noisy flag is %s",
    (presetNoisy) => {
      const { container } = renderTable(presetNoisy);

      expect(container.querySelector("[data-ringing]")).toBeNull();
      expect(
        container.querySelector(".motion-safe\\:before\\:animate-ringing-pulse")
      ).toBeNull();
      expect(screen.queryByText(RINGING_REASON)).toBeNull();
    }
  );

  it("starts every ringing cell's pulse at the page's time zero", () => {
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
    const { container } = renderTable(true);

    expect(synced).toEqual(expect.arrayContaining(cellsOfRow(container, 0)));
    cellsOfRow(container, 2).forEach((cell) =>
      expect(synced).not.toContain(cell)
    );
  });
});
