import { ColumnSizingState, defaultColumnSizing } from "@tanstack/react-table";
import { WIDGET_PINNED_LEFT } from "./alert-table-widget-config";

/** The sizing fields of a column definition. */
export interface SizedColumn {
  id?: string;
  size?: number;
  minSize?: number;
  maxSize?: number;
}

/** The smallest and largest width, in pixels, a column accepts. */
export interface ColumnBounds {
  min: number;
  max: number;
}

/** How an Alert Table widget lays its visible columns out at its current width. */
export interface WidgetColumnLayout {
  /** The sizing to render with: the saved widths, plus the flexible column's widened width. */
  columnSizing: ColumnSizingState;
  /** The table's width in pixels, or undefined while the widget's width is unknown. */
  tableWidth?: number;
  /** The flexible column, when its widened width passes its maximum. */
  unclampedColumnId?: string;
}

const FLEX_PREFERENCE = ["description", "name"];

/** Returns a column's width bounds, falling back to the table's defaults. */
export function getColumnBounds(column: SizedColumn): ColumnBounds {
  return {
    min: column.minSize ?? defaultColumnSizing.minSize,
    max: column.maxSize ?? defaultColumnSizing.maxSize,
  };
}

/**
 * Returns the width a column renders at, as the table computes it: the saved
 * width, else the column's default size, kept within its bounds.
 */
export function getColumnSize(column: SizedColumn, saved?: number): number {
  const { min, max } = getColumnBounds(column);
  return Math.min(
    Math.max(min, saved ?? column.size ?? defaultColumnSizing.size),
    max
  );
}

/**
 * Chooses the column that takes a widget's spare width from its visible,
 * non-pinned columns in display order.
 *
 * Candidates are description, then name, then the movable columns from last
 * to first. The first candidate with no saved width wins, so a width someone
 * set stays exact. When every candidate has one, the first candidate wins.
 */
export function getFlexColumnId(
  movableIds: readonly string[],
  savedSizing: ColumnSizingState
): string | undefined {
  const candidates = Array.from(
    new Set([
      ...FLEX_PREFERENCE.filter((id) => movableIds.includes(id)),
      ...[...movableIds].reverse(),
    ])
  );
  return (
    candidates.find((id) => savedSizing[id] === undefined) ?? candidates[0]
  );
}

/**
 * Lays an Alert Table widget's visible columns out in a container
 * `containerWidth` pixels wide.
 *
 * Every column keeps its own width (saved, else default). When they add up to
 * less than the container, the flexible column (`getFlexColumnId`) takes the
 * difference, past its maximum if need be, and the table is exactly as wide as
 * the container; pinned columns therefore never widen. When they add up to
 * more, the table is as wide as the columns and scrolls. With an unknown
 * width, the saved sizing is returned as is and no table width is set.
 * `visibleOrder` lists the visible column ids in display order; ids with no
 * column in `columns` are skipped.
 */
export function getWidgetColumnLayout({
  columns,
  visibleOrder,
  savedSizing,
  containerWidth,
}: {
  columns: readonly SizedColumn[];
  visibleOrder: readonly string[];
  savedSizing: ColumnSizingState;
  containerWidth: number | null;
}): WidgetColumnLayout {
  if (containerWidth === null) {
    return { columnSizing: savedSizing };
  }
  const byId = new Map(columns.map((column) => [column.id, column]));
  const visibleIds = visibleOrder.filter((id) => byId.has(id));
  const sizeOf = (id: string) =>
    getColumnSize(byId.get(id) as SizedColumn, savedSizing[id]);
  const total = visibleIds.reduce((sum, id) => sum + sizeOf(id), 0);
  const spare = containerWidth - total;
  const flexColumnId =
    spare > 0
      ? getFlexColumnId(
          visibleIds.filter((id) => !WIDGET_PINNED_LEFT.includes(id)),
          savedSizing
        )
      : undefined;

  if (flexColumnId === undefined) {
    return { columnSizing: savedSizing, tableWidth: total };
  }
  const flexSize = sizeOf(flexColumnId) + spare;
  const { max } = getColumnBounds(byId.get(flexColumnId) as SizedColumn);
  return {
    columnSizing: { ...savedSizing, [flexColumnId]: flexSize },
    tableWidth: containerWidth,
    unclampedColumnId: flexSize > max ? flexColumnId : undefined,
  };
}

/**
 * Returns `columns` with the maximum width of `unclampedColumnId` lifted, so
 * the table renders that column at its full widened width. Returns `columns`
 * itself when no column is unclamped.
 */
export function withUnclampedColumn<T extends SizedColumn>(
  columns: T[],
  unclampedColumnId: string | undefined
): T[] {
  if (unclampedColumnId === undefined) {
    return columns;
  }
  return columns.map((column) =>
    column.id === unclampedColumnId
      ? { ...column, maxSize: Number.MAX_SAFE_INTEGER }
      : column
  );
}
