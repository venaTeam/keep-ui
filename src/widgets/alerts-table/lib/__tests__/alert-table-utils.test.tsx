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

  it("renders a dimmed icon without a link when links are disabled", () => {
    render(
      <GeneratedColumn
        columnId="alert_rule_url"
        value={GRAFANA_RULE_URL}
        meta={{ linksDisabled: true }}
      />
    );

    expect(
      screen.getByTestId("cell").querySelector('[aria-disabled="true"]')
    ).not.toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
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
