import { createElement } from "react";
import { utils } from "react-grid-layout";
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
