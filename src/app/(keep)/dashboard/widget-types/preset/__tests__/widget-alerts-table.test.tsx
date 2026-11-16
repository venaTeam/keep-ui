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
  const BLINK = "motion-safe:animate-missing-blink";
  const STEADY = "motion-reduce:bg-[color:var(--blink-soft)]";
  const columns = ["status", "name", "description"];
  const alerts = [
    { name: "ring", severity: "critical", status: "firing" },
    { name: "ring-numeric", severity: 5, status: "firing" },
    { name: "quiet-resolved", severity: "critical", status: "resolved" },
    { name: "quiet-high", severity: "high", status: "firing" },
    {
      name: "quiet-deleted",
      severity: "critical",
      status: "firing",
      deleted: true,
    },
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

  it("gives every cell of a critical firing row the pulse in a noisy preset", () => {
    const { container } = renderTable(true);

    for (const rowIndex of [0, 1]) {
      const cells = cellsOfRow(container, rowIndex);
      expect(cells).toHaveLength(columns.length);
      cells.forEach((cell) => {
        expect(cell).toHaveClass(BLINK, STEADY);
        expect(cell).toHaveAttribute("data-ringing", "true");
        expect(cell.style.getPropertyValue("--blink-strong")).not.toBe("");
      });
      expect(cells[0]).toHaveTextContent(RINGING_REASON);
    }
    expect(screen.getAllByText(RINGING_REASON)).toHaveLength(2);
    screen
      .getAllByText(RINGING_REASON)
      .forEach((reason) => expect(reason).toHaveClass("sr-only"));
  });

  it("leaves the other rows as they were", () => {
    const { container } = renderTable(true);

    for (const rowIndex of [2, 3]) {
      cellsOfRow(container, rowIndex).forEach((cell) => {
        expect(cell).not.toHaveClass(BLINK);
        expect(cell).not.toHaveAttribute("data-ringing");
        expect(cell.getAttribute("style")).toBeNull();
      });
    }
  });

  it("does not ring a deleted critical firing alert", () => {
    const { container } = renderTable(true);

    cellsOfRow(container, 4).forEach((cell) => {
      expect(cell).not.toHaveClass(BLINK);
      expect(cell).not.toHaveAttribute("data-ringing");
    });
    expect(screen.getAllByText(RINGING_REASON)).toHaveLength(2);
  });

  it.each([false, undefined])(
    "rings nothing when the preset's noisy flag is %s",
    (presetNoisy) => {
      const { container } = renderTable(presetNoisy);

      expect(container.querySelector("[data-ringing]")).toBeNull();
      expect(
        container.querySelector(".motion-safe\\:animate-missing-blink")
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
      const { container } = renderTable(true);

      expect(synced).toEqual(
        expect.arrayContaining([
          ...cellsOfRow(container, 0),
          ...cellsOfRow(container, 1),
        ])
      );
      cellsOfRow(container, 3).forEach((cell) =>
        expect(synced).not.toContain(cell)
      );
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
    }
  });
});
