import React from "react";
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

jest.mock("react-icons/md", () => jest.requireActual("react-icons/md"));

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

const GRAFANA_RULE_URL =
  "https://grafana-olly.com/alerting/grafana/aef3k2pq/view?orgId=1";
const PROMETHEUS_RULE_URL =
  "http://prometheus.ops.internal/alerts?search=PodCrashLooping";
const RUNBOOK_URL = "https://wiki.ops.internal/runbooks/high-cpu-usage";
const LINK_PRESET = "link-icons-test";

/**
 * Renders the header and the generated cell of one column of a one-row table
 * built from useAlertTableCols.
 */
function GeneratedColumn({
  columnId,
  value,
  meta,
}: {
  columnId: string;
  value: unknown;
  meta?: Record<string, unknown>;
}) {
  const columns = useAlertTableCols({
    additionalColsToGenerate: [columnId],
    presetName: LINK_PRESET,
  });
  const table = useReactTable({
    data: [{ fingerprint: "fp-1", [columnId]: value } as unknown as AlertDto],
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta,
  });
  const cell = table
    .getRowModel()
    .rows[0].getAllCells()
    .find((c) => c.column.id === columnId)!;
  return (
    <>
      <div data-testid="header">
        {flexRender(cell.column.columnDef.header, {} as never)}
      </div>
      <div data-testid="sizes">
        {`${cell.column.columnDef.minSize}-${cell.column.columnDef.maxSize}`}
      </div>
      <div data-testid="cell">
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </div>
    </>
  );
}

/** Renders the Rule and Runbook cells of a one-row table built from useAlertTableCols. */
function RuleAndRunbookCells() {
  const columns = useAlertTableCols({
    additionalColsToGenerate: ["alert_rule_url", "runbook_url"],
    presetName: LINK_PRESET,
  });
  const table = useReactTable({
    data: [
      {
        fingerprint: "fp-1",
        alert_rule_url: GRAFANA_RULE_URL,
        runbook_url: RUNBOOK_URL,
      } as unknown as AlertDto,
    ],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div>
      {table
        .getRowModel()
        .rows[0].getAllCells()
        .filter((cell) => ["alert_rule_url", "runbook_url"].includes(cell.column.id))
        .map((cell) => (
          <div key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        ))}
    </div>
  );
}

describe("useAlertTableCols rule and runbook icon links", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("renders a Grafana rule URL as the Grafana logo link", () => {
    render(<GeneratedColumn columnId="alert_rule_url" value={GRAFANA_RULE_URL} />);

    const link = screen.getByRole("link", { name: "Open alert rule in Grafana" });
    expect(link).toHaveAttribute("href", GRAFANA_RULE_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.querySelector("img")?.getAttribute("src")).toContain(
      "grafana-icon.png"
    );
  });

  it("stacks its tooltip above the presets page's CEL search bar", async () => {
    render(<GeneratedColumn columnId="runbook_url" value={RUNBOOK_URL} />);

    fireEvent.focus(screen.getByRole("link", { name: "Open runbook" }));

    expect((await screen.findByRole("tooltip")).closest(".z-60")).not.toBeNull();
  });

  it("never lets its tooltip catch the pointer", async () => {
    render(<GeneratedColumn columnId="runbook_url" value={RUNBOOK_URL} />);

    fireEvent.focus(screen.getByRole("link", { name: "Open runbook" }));

    const tooltip = await screen.findByRole("tooltip");
    expect(
      tooltip.closest(".alert-link-tooltip.pointer-events-none.z-60")
    ).not.toBeNull();
  });

  it("renders its content inside Radix's floating wrapper, which the stylesheet targets", async () => {
    render(<GeneratedColumn columnId="runbook_url" value={RUNBOOK_URL} />);
    fireEvent.focus(screen.getByRole("link", { name: "Open runbook" }));

    const content = (await screen.findByRole("tooltip")).closest(
      ".alert-link-tooltip"
    )!;

    expect(content.closest("[data-radix-popper-content-wrapper]")).not.toBeNull();
  });

  it("makes the floating wrapper of a Rule or Runbook tooltip pointer-transparent, and no other tooltip's", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(
      join(__dirname, "../../ui/alert-link-icon-cell.css"),
      "utf8"
    );
    document.head.appendChild(style);
    const host = document.createElement("div");
    host.innerHTML = `
      <div data-radix-popper-content-wrapper id="link-wrapper">
        <div class="alert-link-tooltip pointer-events-none z-60">Open runbook</div>
      </div>
      <div data-radix-popper-content-wrapper id="other-wrapper">
        <div>Other tooltip</div>
      </div>`;
    document.body.appendChild(host);
    try {
      expect(
        getComputedStyle(document.getElementById("link-wrapper")!).pointerEvents
      ).toBe("none");
      expect(
        getComputedStyle(document.getElementById("other-wrapper")!).pointerEvents
      ).not.toBe("none");
    } finally {
      style.remove();
      host.remove();
    }
  });

  it("hands the tooltip over when the pointer moves from one icon to the next", () => {
    jest.useFakeTimers();
    try {
      render(<RuleAndRunbookCells />);
      const rule = screen.getByRole("link", { name: "Open alert rule in Grafana" });
      const runbook = screen.getByRole("link", { name: "Open runbook" });
      rule.getBoundingClientRect = () =>
        ({ left: 0, right: 24, top: 0, bottom: 24, width: 24, height: 24 }) as DOMRect;
      runbook.getBoundingClientRect = () =>
        ({ left: 0, right: 24, top: 32, bottom: 56, width: 24, height: 24 }) as DOMRect;
      const pointer = (
        target: Element,
        type: string,
        clientY: number,
        relatedTarget: Element | null = null
      ) =>
        act(() => {
          target.dispatchEvent(
            new MouseEvent(type, {
              bubbles: !type.endsWith("enter") && !type.endsWith("leave"),
              clientX: 12,
              clientY,
              relatedTarget,
            })
          );
        });
      const tooltipText = () =>
        screen.queryAllByRole("tooltip").map((tooltip) => tooltip.textContent);

      pointer(rule, "pointerover", 12);
      pointer(rule, "pointermove", 12);
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(tooltipText()).toEqual([
        expect.stringContaining("Open alert rule in Grafana"),
      ]);

      pointer(rule, "pointerout", 30, runbook);
      pointer(rule, "pointerleave", 30, runbook);
      pointer(runbook, "pointerover", 40, rule);
      pointer(runbook, "pointermove", 40);
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(tooltipText()).toEqual([expect.stringContaining("Open runbook")]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("renders a non-Grafana rule URL as a generic link icon", () => {
    render(
      <GeneratedColumn columnId="alert_rule_url" value={PROMETHEUS_RULE_URL} />
    );

    const link = screen.getByRole("link", { name: "Open alert rule" });
    expect(link).toHaveAttribute("href", PROMETHEUS_RULE_URL);
    expect(screen.getByTestId("cell").querySelector("img")).toBeNull();
  });

  it("renders a runbook URL as a book icon link", () => {
    render(<GeneratedColumn columnId="runbook_url" value={RUNBOOK_URL} />);

    expect(screen.getByRole("link", { name: "Open runbook" })).toHaveAttribute(
      "href",
      RUNBOOK_URL
    );
  });

  it.each([
    "see on-call wiki",
    "javascript:alert(1)",
    "grafana-olly.com/alerting/grafana/x/view",
  ])("renders %s as plain text", (value) => {
    render(<GeneratedColumn columnId="runbook_url" value={value} />);

    expect(screen.getByTestId("cell")).toHaveTextContent(value);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links a URL with surrounding whitespace to the trimmed URL", () => {
    render(<GeneratedColumn columnId="runbook_url" value="  https://wiki/x  " />);

    expect(screen.getByRole("link", { name: "Open runbook" })).toHaveAttribute(
      "href",
      "https://wiki/x"
    );
  });

  it("renders a dimmed, named, disabled link without an href when links are disabled", () => {
    render(
      <GeneratedColumn
        columnId="alert_rule_url"
        value={GRAFANA_RULE_URL}
        meta={{ linksDisabled: true }}
      />
    );

    const link = screen.getByRole("link", { name: "Open alert rule in Grafana" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).not.toHaveAttribute("href");
    expect(link).not.toHaveAttribute("tabindex");
    expect(screen.getByTestId("cell").querySelector("[href]")).toBeNull();
  });

  it("keeps the full URL link for other URL columns", () => {
    render(<GeneratedColumn columnId="url" value="https://example.com/a" />);

    const link = screen.getByRole("link", { name: "https://example.com/a" });
    expect(link).toHaveAttribute("href", "https://example.com/a");
  });

  it.each([
    ["alert_rule_url", "Rule"],
    ["runbook_url", "Runbook"],
  ])("heads %s as %s", (columnId, label) => {
    render(<GeneratedColumn columnId={columnId} value={null} />);

    expect(screen.getByTestId("header").textContent).toBe(label);
  });

  it("heads the runbook column with its rename", () => {
    localStorage.setItem(
      `keephq-column-rename-mapping-${LINK_PRESET}`,
      JSON.stringify({ runbook_url: "RB" })
    );
    render(<GeneratedColumn columnId="runbook_url" value={null} />);

    expect(screen.getByTestId("header").textContent).toBe("RB");
  });

  it("falls back to Runbook when the rename is empty", () => {
    localStorage.setItem(
      `keephq-column-rename-mapping-${LINK_PRESET}`,
      JSON.stringify({ runbook_url: "" })
    );
    render(<GeneratedColumn columnId="runbook_url" value={null} />);

    expect(screen.getByTestId("header").textContent).toBe("Runbook");
  });

  it.each(["alert_rule_url", "runbook_url"])(
    "sizes %s between 44 and 120",
    (columnId) => {
      render(<GeneratedColumn columnId={columnId} value={null} />);

      expect(screen.getByTestId("sizes").textContent).toBe("44-120");
    }
  );
});

/** Renders the Last Received cell of a one-row table built from useAlertTableCols. */
function LastReceivedCell({ value }: { value: unknown }) {
  const columns = useAlertTableCols({ presetName: "last-received-test" });
  const table = useReactTable({
    data: [{ fingerprint: "fp-1", lastReceived: value } as unknown as AlertDto],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const cell = table
    .getRowModel()
    .rows[0].getAllCells()
    .find((c) => c.column.id === "lastReceived")!;
  return (
    <div data-testid="cell">
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </div>
  );
}

describe("useAlertTableCols Last Received column", () => {
  it("truncates its text inside the cell, keeping the full text and the ISO title", () => {
    render(<LastReceivedCell value="2025-01-15T08:30:00.000Z" />);

    const span = screen.getByTestId("cell").firstElementChild!;
    expect(span).toHaveClass("block", "truncate", "select-text");
    expect(span.textContent).toMatch(/ ago$/);
    expect(span).toHaveAttribute("title", "2025-01-15T08:30:00.000Z");
  });
});
