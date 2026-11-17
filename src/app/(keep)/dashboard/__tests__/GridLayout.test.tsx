import React from "react";
import { act, render } from "@testing-library/react";
import type { Layout } from "react-grid-layout";
import GridLayout from "../GridLayout";
import { DashboardEditModeProvider } from "../DashboardEditModeContext";
import { GRID_COLS, GRID_COMPACT_TYPE, layoutBottom } from "../widget-layout";

const mockGridProps: { current: Record<string, any> } = { current: {} };

jest.mock("react-grid-layout", () => {
  const actual = jest.requireActual("react-grid-layout");
  return {
    __esModule: true,
    default: actual,
    utils: actual.utils,
    Responsive: (props: any) => {
      mockGridProps.current = props;
      return <div>{props.children}</div>;
    },
    WidthProvider: (component: any) => component,
  };
});

type CompactType = "vertical" | "horizontal" | null;

interface GridUtils {
  moveElement(
    layout: Layout[],
    item: Layout,
    x: number,
    y: number,
    isUserAction: boolean,
    preventCollision: boolean,
    compactType: CompactType,
    cols: number,
    allowOverlap: boolean
  ): Layout[];
  compact(layout: Layout[], compactType: CompactType, cols: number): Layout[];
  collides(a: Layout, b: Layout): boolean;
  getLayoutItem(layout: Layout[], id: string): Layout | undefined;
  cloneLayout(layout: Layout[]): Layout[];
}

const utils: GridUtils = jest.requireActual("react-grid-layout").utils;

const COLS = GRID_COLS;
const STEPS_PER_WAYPOINT = 25;

const fixture = (): Layout[] => [
  { i: "c1", x: 0, y: 0, w: 6, h: 5 },
  { i: "c2", x: 6, y: 0, w: 6, h: 5 },
  { i: "h1", x: 12, y: 0, w: 6, h: 5 },
  { i: "c3", x: 18, y: 0, w: 6, h: 5 },
  { i: "t1", x: 0, y: 5, w: 12, h: 10 },
  { i: "h2", x: 12, y: 5, w: 12, h: 10 },
  { i: "c4", x: 0, y: 15, w: 24, h: 4 },
];

const item = (layout: Layout[], id: string): Layout => {
  const found = utils.getLayoutItem(layout, id);
  if (!found) {
    throw new Error(`no panel ${id}`);
  }
  return found;
};

const positions = (layout: Layout[]) =>
  Object.fromEntries(layout.map((l) => [l.i, [l.x, l.y]]));

const hasOverlap = (layout: Layout[]) =>
  layout.some((a, k) => layout.slice(k + 1).some((b) => utils.collides(a, b)));

const move = (layout: Layout[], id: string, x: number, y: number) =>
  utils.moveElement(layout, item(layout, id), x, y, true, false, GRID_COMPACT_TYPE, COLS, false);

/**
 * Replays a pointer drag the way react-grid-layout 1.5's drag handlers run
 * it, calling the grid's onDragStart / onDrag / onDragStop at the same
 * points: every pointer step moves the panel, hands the layout to onDrag and
 * then compacts it; the drop moves and compacts, hands the result to
 * onDragStop, and the library keeps that result.
 */
const drag = (start: Layout[], id: string, waypoints: [number, number][]) => {
  renderGrid(true);
  const grid = mockGridProps.current;
  let layout = utils.compact(utils.cloneLayout(start), GRID_COMPACT_TYPE, COLS);
  let overlapSeen = false;
  grid.onDragStart?.(layout, item(layout, id), item(layout, id));
  let [fromX, fromY] = [item(layout, id).x, item(layout, id).y];
  let [lastX, lastY] = [fromX, fromY];
  for (const [toX, toY] of waypoints) {
    for (let step = 1; step <= STEPS_PER_WAYPOINT; step++) {
      lastX = Math.round(fromX + ((toX - fromX) * step) / STEPS_PER_WAYPOINT);
      lastY = Math.round(fromY + ((toY - fromY) * step) / STEPS_PER_WAYPOINT);
      layout = move(layout, id, lastX, lastY);
      grid.onDrag?.(layout, item(layout, id), item(layout, id));
      layout = utils.compact(layout, GRID_COMPACT_TYPE, COLS);
      overlapSeen = overlapSeen || hasOverlap(layout);
    }
    [fromX, fromY] = [toX, toY];
  }
  layout = move(layout, id, lastX, lastY);
  const dropped = item(layout, id);
  const final = utils.compact(layout, GRID_COMPACT_TYPE, COLS);
  grid.onDragStop?.(final, dropped, dropped);
  return { layout: final, overlapSeen: overlapSeen || hasOverlap(final) };
};

const renderGrid = (isEditMode: boolean) => {
  const onLayoutChange = jest.fn();
  render(
    <DashboardEditModeProvider value={isEditMode}>
      <GridLayout
        layout={[]}
        data={[]}
        onLayoutChange={onLayoutChange}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onSave={jest.fn()}
        presets={[]}
        metrics={[]}
      />
    </DashboardEditModeProvider>
  );
  return onLayoutChange;
};

describe("dashboard grid wiring", () => {
  it("uses vertical compaction without blocking or allowing overlap", () => {
    renderGrid(true);

    expect(mockGridProps.current.compactType).toBe("vertical");
    expect(mockGridProps.current.preventCollision).toBeFalsy();
    expect(mockGridProps.current.allowOverlap).toBeFalsy();
  });

  it("ignores layout changes outside edit mode", () => {
    const viewChange = renderGrid(false);
    act(() => mockGridProps.current.onLayoutChange([{ i: "c1", x: 0, y: 0, w: 6, h: 5 }]));
    expect(viewChange).not.toHaveBeenCalled();

    const editChange = renderGrid(true);
    act(() => mockGridProps.current.onLayoutChange([{ i: "c1", x: 0, y: 0, w: 6, h: 5 }]));
    expect(editChange).toHaveBeenCalledTimes(1);
  });
});

describe("dragging panels", () => {
  it("returns every panel to its place when a drag goes out over others and comes back", () => {
    const { layout } = drag(fixture(), "c2", [
      [6, 10],
      [6, 0],
    ]);

    expect(positions(layout)).toEqual(positions(fixture()));
  });

  it("does not displace panels a drag only passes over", () => {
    const { layout } = drag(fixture(), "c1", [[0, 22]]);

    const start = positions(fixture());
    for (const id of ["t1", "c2", "h1", "c3", "h2", "c4"]) {
      expect([id, positions(layout)[id]]).toEqual([id, start[id]]);
    }
  });

  it("returns every panel to its place when the dragged panel comes back after another floated up", () => {
    const start: Layout[] = [
      { i: "p1", x: 12, y: 0, w: 9, h: 4 },
      { i: "p2", x: 4, y: 7, w: 7, h: 6 },
      { i: "p3", x: 4, y: 4, w: 9, h: 3 },
    ];

    const { layout } = drag(start, "p3", [
      [0, 4],
      [4, 4],
    ]);

    expect(positions(layout)).toEqual(positions(start));
  });

  it("pushes the panels under a drop just below the dropped panel", () => {
    const { layout } = drag(fixture(), "c4", [[0, 0]]);

    const dropped = item(layout, "c4");
    expect(item(layout, "c1").y).toBe(dropped.y + dropped.h);
    expect(item(layout, "t1").y).toBe(item(layout, "c1").y + item(layout, "c1").h);
  });

  it("lands below a taller panel when dropped on its lower part", () => {
    const { layout } = drag(fixture(), "c1", [[3, 10]]);

    const taller = item(layout, "t1");
    expect([taller.x, taller.y]).toEqual([0, 5]);
    expect(item(layout, "c1").y).toBe(taller.y + taller.h);
  });

  it("never overlaps panels at any step", () => {
    const scenarios: [string, [number, number][]][] = [
      ["c1", [[6, 0]]],
      ["c1", [[3, 10]]],
      ["c4", [[0, 0]]],
      ["c3", [[15, 10]]],
      ["c2", [[6, 10], [6, 0]]],
      ["t1", [[12, 5]]],
      ["c1", [[0, 22]]],
      ["c2", [[6, 3]]],
    ];

    for (const [id, waypoints] of scenarios) {
      expect([id, waypoints, drag(fixture(), id, waypoints).overlapSeen]).toEqual([
        id,
        waypoints,
        false,
      ]);
    }
  });

  it("closes a gap above a panel", () => {
    const layout = utils.compact(
      [
        { i: "a", x: 0, y: 0, w: 6, h: 5 },
        { i: "b", x: 0, y: 12, w: 6, h: 5 },
      ],
      GRID_COMPACT_TYPE,
      COLS
    );

    expect(item(layout, "b").y).toBe(5);
  });

  it("restores the panels below when a panel grows and shrinks back", () => {
    let layout = utils.compact(fixture(), GRID_COMPACT_TYPE, COLS);

    layout = utils.compact(
      layout.map((l) => (l.i === "c1" ? { ...l, h: 12 } : l)),
      GRID_COMPACT_TYPE,
      COLS
    );
    expect(item(layout, "t1").y).toBe(12);

    layout = utils.compact(
      layout.map((l) => (l.i === "c1" ? { ...l, h: 5 } : l)),
      GRID_COMPACT_TYPE,
      COLS
    );
    expect(item(layout, "t1").y).toBe(5);
    expect(item(layout, "c4").y).toBe(15);
  });

  it("places a new widget below the panels without moving any", () => {
    const layout = utils.compact(
      [...fixture(), { i: "new", x: 0, y: layoutBottom(fixture()), w: 3, h: 3 }],
      GRID_COMPACT_TYPE,
      COLS
    );

    expect(positions(layout)).toEqual({ ...positions(fixture()), new: [0, 19] });
  });
});
