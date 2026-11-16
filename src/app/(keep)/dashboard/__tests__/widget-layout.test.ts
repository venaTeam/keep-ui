import { applyEditedItemToLayout, compactLayout } from "../widget-layout";
import { LayoutItem, WidgetData } from "../types";

const panel = (i: string, x: number, y: number, w: number, h: number): LayoutItem => ({
  i,
  x,
  y,
  w,
  h,
  static: false,
});

const positions = (layout: LayoutItem[]) =>
  Object.fromEntries(layout.map(({ i, x, y }) => [i, [x, y]]));

describe("compactLayout", () => {
  it("pulls a panel that overflows the grid back inside, as the grid shows it", () => {
    const result = compactLayout([panel("a", 20, 0, 8, 3), panel("b", 16, 3, 4, 3)], ["a", "b"]);

    expect(positions(result)).toEqual({ a: [16, 0], b: [16, 3] });
  });

  it("stacks panels saved at the same spot in widget order", () => {
    const result = compactLayout([panel("a", 0, 0, 6, 3), panel("b", 0, 0, 6, 3)], ["b", "a"]);

    expect(positions(result)).toEqual({ b: [0, 0], a: [0, 3] });
  });

  it("keeps only panels that have a widget and adds widgets missing from the layout", () => {
    const result = compactLayout([panel("a", 0, 0, 6, 5), panel("ghost", 0, 5, 6, 5)], ["a", "c"]);

    expect(positions(result)).toEqual({ a: [0, 0], c: [0, 5] });
  });

  it("does not change the saved layout it is given", () => {
    const saved = [panel("a", 0, 0, 6, 4), panel("b", 0, 0, 6, 4), panel("c", 0, 4, 6, 4)];
    const before = JSON.parse(JSON.stringify(saved));

    compactLayout(saved, ["a", "b", "c"]);

    expect(saved).toEqual(before);
  });
});

const entry = (overrides: Partial<LayoutItem> = {}): LayoutItem => ({
  i: "w1",
  x: 2,
  y: 5,
  w: 4,
  h: 3,
  minW: 0,
  minH: 2,
  static: false,
  ...overrides,
});

const edited = (overrides: Record<string, unknown> = {}) =>
  ({ ...entry(), name: "Prod", widgetType: "PRESET", ...overrides }) as unknown as WidgetData;

describe("applyEditedItemToLayout", () => {
  it("copies the height and minimum height onto the matching entry only", () => {
    const layout = [entry(), entry({ i: "w2", h: 6, minH: 4 })];

    const result = applyEditedItemToLayout(layout, edited({ h: 4, minH: 4 }));

    expect(result[0]).toEqual(entry({ h: 4, minH: 4 }));
    expect(result[1]).toEqual(layout[1]);
  });

  it("keeps the position and width of the matching entry", () => {
    const result = applyEditedItemToLayout(
      [entry()],
      edited({ x: 99, y: 99, w: 99, h: 4, minH: 4 })
    );

    expect(result[0]).toMatchObject({ x: 2, y: 5, w: 4, minW: 0, static: false });
  });

  it("ignores a height or minimum height that is not a number", () => {
    const result = applyEditedItemToLayout(
      [entry()],
      edited({ h: "4", minH: undefined })
    );

    expect(result[0]).toEqual(entry());
  });

  it("applies only the field that is a number", () => {
    const result = applyEditedItemToLayout(
      [entry()],
      edited({ h: null, minH: 4 })
    );

    expect(result[0]).toEqual(entry({ minH: 4 }));
  });

  it("does not mutate its input", () => {
    const layout = [entry(), entry({ i: "w2" })];
    const snapshot = JSON.parse(JSON.stringify(layout));

    const result = applyEditedItemToLayout(layout, edited({ h: 4, minH: 4 }));

    expect(layout).toEqual(snapshot);
    expect(result).not.toBe(layout);
    expect(result[0]).not.toBe(layout[0]);
  });

  it("returns an equal array for an id that is not in the layout", () => {
    const layout = [entry(), entry({ i: "w2" })];

    const result = applyEditedItemToLayout(layout, edited({ i: "missing", h: 9 }));

    expect(result).toEqual(layout);
    expect(result).not.toBe(layout);
  });
});
