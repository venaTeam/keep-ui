import { applyEditedItemToLayout } from "../widget-layout";
import { LayoutItem, WidgetData } from "../types";

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
