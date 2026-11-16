import {
  getColumnBounds,
  getColumnSize,
  getFlexColumnId,
  getWidgetColumnLayout,
  withUnclampedColumn,
} from "../widget-column-layout";

const COLUMNS = [
  { id: "severity", maxSize: 2 },
  { id: "status", size: 36, minSize: 36, maxSize: 36 },
  { id: "source", size: 44, minSize: 44, maxSize: 44 },
  { id: "name", size: 100, minSize: 100, maxSize: 600 },
  { id: "description", size: 100, minSize: 100, maxSize: 800 },
  { id: "lastReceived", size: 80, minSize: 80, maxSize: 220 },
  { id: "assignee", size: 100, minSize: 100, maxSize: 400 },
];
const DEFAULT_ORDER = [
  "severity",
  "status",
  "source",
  "name",
  "description",
  "lastReceived",
];
const DEFAULT_TOTAL = 2 + 36 + 44 + 100 + 100 + 80;

const layout = (
  containerWidth: number | null,
  savedSizing: Record<string, number> = {},
  visibleOrder: string[] = DEFAULT_ORDER
) =>
  getWidgetColumnLayout({
    columns: COLUMNS,
    visibleOrder,
    savedSizing,
    containerWidth,
  });

describe("getColumnSize", () => {
  it("uses the saved width, else the default size, kept within the bounds", () => {
    const column = { size: 100, minSize: 100, maxSize: 600 };

    expect(getColumnSize(column)).toBe(100);
    expect(getColumnSize(column, 240)).toBe(240);
    expect(getColumnSize(column, 40)).toBe(100);
    expect(getColumnSize(column, 900)).toBe(600);
  });

  it("falls back to the table's default size and bounds", () => {
    expect(getColumnSize({})).toBe(150);
    expect(getColumnSize({ maxSize: 2 })).toBe(2);
    expect(getColumnSize({}, 5)).toBe(20);
  });
});

describe("getColumnBounds", () => {
  it("reads the column's bounds, falling back to the table defaults", () => {
    expect(getColumnBounds({ minSize: 100, maxSize: 600 })).toEqual({
      min: 100,
      max: 600,
    });
    expect(getColumnBounds({})).toEqual({
      min: 20,
      max: Number.MAX_SAFE_INTEGER,
    });
  });
});

describe("getFlexColumnId", () => {
  it("picks description, then name, then the last movable column", () => {
    expect(getFlexColumnId(["name", "description", "lastReceived"], {})).toBe(
      "description"
    );
    expect(getFlexColumnId(["lastReceived", "name", "assignee"], {})).toBe(
      "name"
    );
    expect(getFlexColumnId(["lastReceived", "assignee"], {})).toBe("assignee");
  });

  it("passes over a column whose width is saved", () => {
    expect(
      getFlexColumnId(["name", "description", "lastReceived"], {
        description: 300,
      })
    ).toBe("name");
    expect(
      getFlexColumnId(["name", "description", "lastReceived"], {
        description: 300,
        name: 200,
      })
    ).toBe("lastReceived");
    expect(
      getFlexColumnId(["lastReceived", "assignee"], { assignee: 150 })
    ).toBe("lastReceived");
  });

  it("falls back to the first candidate when every movable width is saved", () => {
    expect(
      getFlexColumnId(["name", "description"], { name: 200, description: 300 })
    ).toBe("description");
  });

  it("has no flexible column when no movable column is visible", () => {
    expect(getFlexColumnId([], {})).toBeUndefined();
  });
});

describe("getWidgetColumnLayout", () => {
  it("keeps the saved sizing and sets no table width while the width is unknown", () => {
    const saved = { name: 240 };

    expect(layout(null, saved)).toEqual({ columnSizing: saved });
  });

  it("gives the spare width to the flexible column and sizes the table to the container", () => {
    const result = layout(DEFAULT_TOTAL + 500);

    expect(result.tableWidth).toBe(DEFAULT_TOTAL + 500);
    expect(result.flexColumnId).toBe("description");
    expect(result.columnSizing).toEqual({ description: 600 });
  });

  it("keeps the columns' own widths and overflows when they do not fit", () => {
    const result = layout(250);

    expect(result.tableWidth).toBe(DEFAULT_TOTAL);
    expect(result.flexColumnId).toBeUndefined();
    expect(result.columnSizing).toEqual({});
  });

  it("fills an exact fit with no flexible column", () => {
    const result = layout(DEFAULT_TOTAL);

    expect(result.tableWidth).toBe(DEFAULT_TOTAL);
    expect(result.flexColumnId).toBeUndefined();
  });

  it("keeps a saved width on name exact while description flexes", () => {
    const result = layout(1000, { name: 240 });

    expect(result.columnSizing).toEqual({
      name: 240,
      description: 100 + 1000 - (DEFAULT_TOTAL + 140),
    });
    expect(result.tableWidth).toBe(1000);
  });

  it("gives the spare width to name when description has a saved width", () => {
    const result = layout(1000, { description: 300 });

    expect(result.flexColumnId).toBe("name");
    expect(result.columnSizing).toEqual({
      description: 300,
      name: 100 + 1000 - (DEFAULT_TOTAL + 200),
    });
  });

  it("counts only the visible columns the widget can build", () => {
    const result = layout(600, {}, ["status", "name", "unknown"]);

    expect(result.tableWidth).toBe(600);
    expect(result.columnSizing).toEqual({ name: 600 - 36 });
  });

  it("keeps a table of pinned columns at their total width", () => {
    const result = layout(600, {}, ["severity", "status", "source"]);

    expect(result.tableWidth).toBe(82);
    expect(result.flexColumnId).toBeUndefined();
    expect(result.columnSizing).toEqual({});
  });

  it("names the flexible column as unclamped once it passes its maximum", () => {
    expect(layout(DEFAULT_TOTAL + 500).unclampedColumnId).toBeUndefined();

    const wide = layout(2000);
    expect(wide.columnSizing).toEqual({
      description: 100 + 2000 - DEFAULT_TOTAL,
    });
    expect(wide.unclampedColumnId).toBe("description");
  });
});

describe("withUnclampedColumn", () => {
  it("returns the columns unchanged when no column is unclamped", () => {
    expect(withUnclampedColumn(COLUMNS, undefined)).toBe(COLUMNS);
  });

  it("lifts only the unclamped column's maximum", () => {
    const result = withUnclampedColumn(COLUMNS, "description");

    expect(result.find((column) => column.id === "description")).toEqual({
      ...COLUMNS[4],
      maxSize: Number.MAX_SAFE_INTEGER,
    });
    expect(result.filter((column) => column.id !== "description")).toEqual(
      COLUMNS.filter((column) => column.id !== "description")
    );
  });
});
