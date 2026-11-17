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
  /** The flexible column, when it gives up width below its minimum so the table needs less room. */
  shrunkColumnId?: string;
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
 * more, the flexible column first gives up to `shrinkAllowance` pixels, below
 * its minimum if need be but never under the table's default minimum, and
 * the table scrolls by whatever is still missing. Callers pass the width of
 * chrome they place beside the columns, so that chrome never makes a widget
 * scroll that fits without it. With an unknown width, the saved sizing is
 * returned as is and no table width is set. `visibleOrder` lists the visible
 * column ids in display order; ids with no column in `columns` are skipped.
 */
export function getWidgetColumnLayout({
  columns,
  visibleOrder,
  savedSizing,
  containerWidth,
  shrinkAllowance = 0,
}: {
  columns: readonly SizedColumn[];
  visibleOrder: readonly string[];
  savedSizing: ColumnSizingState;
  containerWidth: number | null;
  shrinkAllowance?: number;
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
    spare > 0 || (spare < 0 && shrinkAllowance > 0)
      ? getFlexColumnId(
          visibleIds.filter((id) => !WIDGET_PINNED_LEFT.includes(id)),
          savedSizing
        )
      : undefined;

  if (flexColumnId === undefined) {
    return { columnSizing: savedSizing, tableWidth: total };
  }
  const ownSize = sizeOf(flexColumnId);
  const flexSize =
    spare > 0
      ? ownSize + spare
      : ownSize -
        Math.min(
          -spare,
          shrinkAllowance,
          Math.max(0, ownSize - defaultColumnSizing.minSize)
        );
  const { min, max } = getColumnBounds(byId.get(flexColumnId) as SizedColumn);
  return {
    columnSizing: { ...savedSizing, [flexColumnId]: flexSize },
    tableWidth: total - ownSize + flexSize,
    unclampedColumnId: flexSize > max ? flexColumnId : undefined,
    shrunkColumnId: flexSize < min ? flexColumnId : undefined,
  };
}

/**
 * Returns `columns` with the bounds the layout passed lifted, so the table
 * renders the flexible column at its laid-out width: the maximum of
 * `unclampedColumnId`, and the minimum of `shrunkColumnId` down to the
 * table's default minimum, below which the layout never shrinks it. Returns
 * `columns` itself when neither is set.
 */
export function withUnclampedColumn<T extends SizedColumn>(
  columns: T[],
  unclampedColumnId: string | undefined,
  shrunkColumnId?: string
): T[] {
  if (unclampedColumnId === undefined && shrunkColumnId === undefined) {
    return columns;
  }
  return columns.map((column) => {
    if (column.id === unclampedColumnId) {
      return { ...column, maxSize: Number.MAX_SAFE_INTEGER };
    }
    if (column.id === shrunkColumnId) {
      return { ...column, minSize: defaultColumnSizing.minSize };
    }
    return column;
  });
}
