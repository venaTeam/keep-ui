import {
  getColumnBounds,
  getColumnSize,
  getFlexColumnId,
  getWidgetColumnLayout,
  withUnclampedColumns,
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
  it("uses the saved width kept at or above the minimum, never capped at the maximum", () => {
    const column = { size: 100, minSize: 100, maxSize: 600 };

    expect(getColumnSize(column)).toBe(100);
    expect(getColumnSize(column, 240)).toBe(240);
    expect(getColumnSize(column, 40)).toBe(100);
    expect(getColumnSize(column, 900)).toBe(900);
  });

  it("keeps the default size within the bounds", () => {
    expect(getColumnSize({ size: 900, minSize: 100, maxSize: 600 })).toBe(600);
    expect(getColumnSize({ size: 50, minSize: 100, maxSize: 600 })).toBe(100);
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

    expect(layout(null, saved)).toEqual({
      columnSizing: saved,
      unclampedColumnIds: [],
    });
  });

  it("lifts the maximum of a saved width over it while the width is unknown", () => {
    expect(layout(null, { lastReceived: 300 })).toEqual({
      columnSizing: { lastReceived: 300 },
      unclampedColumnIds: ["lastReceived"],
    });
  });

  it("gives the spare width to the flexible column and sizes the table to the container", () => {
    const result = layout(DEFAULT_TOTAL + 500);

    expect(result.tableWidth).toBe(DEFAULT_TOTAL + 500);
    expect(result.columnSizing).toEqual({ description: 600 });
  });

  it("keeps the columns' own widths and overflows when they do not fit", () => {
    const result = layout(250);

    expect(result.tableWidth).toBe(DEFAULT_TOTAL);
    expect(result.columnSizing).toEqual({});
  });

  it("fills an exact fit with no flexible column", () => {
    const result = layout(DEFAULT_TOTAL);

    expect(result.tableWidth).toBe(DEFAULT_TOTAL);
    expect(result.columnSizing).toEqual({});
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
    expect(result.columnSizing).toEqual({});
  });

  it("names the flexible column as unclamped once it passes its maximum", () => {
    expect(layout(DEFAULT_TOTAL + 500).unclampedColumnIds).toEqual([]);

    const wide = layout(2000);
    expect(wide.columnSizing).toEqual({
      description: 100 + 2000 - DEFAULT_TOTAL,
    });
    expect(wide.unclampedColumnIds).toEqual(["description"]);
  });

  describe("saved widths stay exact", () => {
    const REVIEW_ORDER = ["name", "description", "lastReceived"];
    const reviewLayout = (savedSizing: Record<string, number> = {}) =>
      layout(1600, savedSizing, REVIEW_ORDER);
    const renderedWidth = (
      result: ReturnType<typeof layout>,
      columnId: string
    ) => {
      const column = COLUMNS.find((candidate) => candidate.id === columnId)!;
      const { min, max } = getColumnBounds(column);
      const lifted = result.unclampedColumnIds.includes(columnId)
        ? Number.MAX_SAFE_INTEGER
        : max;
      return Math.min(
        Math.max(result.columnSizing[columnId] ?? column.size ?? 150, min),
        lifted
      );
    };

    it("is unchanged with no saved widths: description flexes to 1420", () => {
      const result = reviewLayout();

      expect(result.columnSizing).toEqual({ description: 1420 });
      expect(result.unclampedColumnIds).toEqual(["description"]);
      expect(result.tableWidth).toBe(1600);
      expect(renderedWidth(result, "description")).toBe(1420);
    });

    it("resizing the flex column wider never makes it narrower", () => {
      const before = renderedWidth(reviewLayout(), "description");

      [1, 20, 200, 2000].forEach((delta) => {
        const after = reviewLayout({ description: before + delta });
        expect(renderedWidth(after, "description")).toBe(before + delta);
        expect(renderedWidth(after, "name")).toBe(100);
      });
    });

    it("renders the reviewer's 1440 exactly and scrolls the extra 20px", () => {
      const result = reviewLayout({ description: 1440 });

      expect(renderedWidth(result, "description")).toBe(1440);
      expect(renderedWidth(result, "name")).toBe(100);
      expect(renderedWidth(result, "lastReceived")).toBe(80);
      expect(result.unclampedColumnIds).toEqual(["description"]);
      expect(result.tableWidth).toBe(1620);
    });

    it("keeps a narrower saved width exact and gives the spare to the next candidate", () => {
      const result = reviewLayout({ description: 1400 });

      expect(renderedWidth(result, "description")).toBe(1400);
      expect(renderedWidth(result, "name")).toBe(120);
      expect(result.tableWidth).toBe(1600);
    });

    it("renders a saved width over a non-flex column's maximum exactly, with its maximum lifted", () => {
      const result = reviewLayout({ lastReceived: 300 });

      expect(renderedWidth(result, "lastReceived")).toBe(300);
      expect(renderedWidth(result, "description")).toBe(1600 - 100 - 300);
      expect(result.unclampedColumnIds).toEqual([
        "description",
        "lastReceived",
      ]);
      expect(result.tableWidth).toBe(1600);
    });

    it("clamps a saved width below the minimum up to the minimum", () => {
      const result = reviewLayout({ name: 40 });

      expect(renderedWidth(result, "name")).toBe(100);
      expect(renderedWidth(result, "description")).toBe(1600 - 100 - 80);
    });
  });
});

describe("withUnclampedColumns", () => {
  it("returns the columns unchanged when no column is unclamped", () => {
    expect(withUnclampedColumns(COLUMNS, [])).toBe(COLUMNS);
  });

  it("lifts only the unclamped columns' maximums", () => {
    const lifted = ["description", "lastReceived"];
    const result = withUnclampedColumns(COLUMNS, lifted);

    expect(result.find((column) => column.id === "description")).toEqual({
      ...COLUMNS[4],
      maxSize: Number.MAX_SAFE_INTEGER,
    });
    expect(result.find((column) => column.id === "lastReceived")).toEqual({
      ...COLUMNS[5],
      maxSize: Number.MAX_SAFE_INTEGER,
    });
    expect(
      result.filter((column) => !lifted.includes(column.id as string))
    ).toEqual(COLUMNS.filter((column) => !lifted.includes(column.id)));
  });
});
