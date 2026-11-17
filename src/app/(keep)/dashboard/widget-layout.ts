import { createElement } from "react";
import { utils, type Layout } from "react-grid-layout";
import { LayoutItem, WidgetData } from "./types";

/** Columns of the desktop grid (the lg and md breakpoints). */
export const GRID_COLS = 24;

/**
 * Panels float up into free space, so a drag pushes other panels only as far
 * as needed and they return once the dragged panel moves away (the same
 * behaviour as Grafana and Metabase dashboards).
 */
export const GRID_COMPACT_TYPE = "vertical" as const;

/**
 * The layout the way the grid shows it. Runs the grid's own settling
 * (react-grid-layout's `synchronizeLayoutWithChildren`) over one keyed element
 * per widget, which is what the grid itself receives:
 * - panels are taken in widget order;
 * - panels without a widget are dropped;
 * - widgets without a panel get one at the bottom;
 * - panels are pulled inside the columns and settled up into free space.
 *
 * Keeping the page's layout equal to what is on screen means the grid
 * reporting the same positions (it does after a breakpoint change) is not
 * mistaken for an unsaved edit. The given layout is not modified.
 */
export const compactLayout = (layout: LayoutItem[], widgetIds: string[]): LayoutItem[] =>
  utils.synchronizeLayoutWithChildren(
    layout,
    widgetIds.map((id) => createElement("div", { key: id })),
    GRID_COLS,
    GRID_COMPACT_TYPE,
    false
  ) as LayoutItem[];

/**
 * Where every panel goes while one panel is dragged to (x, y), worked out
 * from the layout as it was when the drag began, with the grid's own move
 * and compaction. Earlier drag steps play no part, so the result depends
 * only on where the panel is now, and dragging it back to its starting spot
 * gives back the starting layout.
 */
export const layoutForDrag = (start: Layout[], id: string, x: number, y: number): Layout[] => {
  const layout = utils.cloneLayout(start);
  const dragged = utils.getLayoutItem(layout, id);
  if (!dragged) {
    return layout;
  }
  return utils.compact(
    utils.moveElement(layout, dragged, x, y, true, false, GRID_COMPACT_TYPE, GRID_COLS, false),
    GRID_COMPACT_TYPE,
    GRID_COLS
  );
};

/** The first row below every panel, where a newly added widget goes. */
export const layoutBottom = (layout: Pick<LayoutItem, "y" | "h">[]): number =>
  layout.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0);

export const applyEditedItemToLayout = (
  layout: LayoutItem[],
  updated: WidgetData
): LayoutItem[] =>
  layout.map((entry) => {
    if (entry.i !== updated.i) {
      return entry;
    }
    return {
      ...entry,
      ...(Number.isFinite(updated.h) ? { h: updated.h } : {}),
      ...(Number.isFinite(updated.minH) ? { minH: updated.minH } : {}),
    };
  });
