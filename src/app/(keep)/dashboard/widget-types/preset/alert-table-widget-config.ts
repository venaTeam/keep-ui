import { camelCase } from "lodash";
import type { VisibilityState } from "@tanstack/react-table";
import type {
  AlertTableWidgetConfig,
  EmptyGroupPosition,
  WidgetData,
} from "../../types";
import { defaultColumns } from "./constants";

export type { AlertTableWidgetConfig, EmptyGroupPosition };
export { isEmptyGroupValue } from "@/widgets/alerts-table/lib/group-values";

/** Row-chrome columns the widget never shows, even when a saved config lists them. */
export const WIDGET_EXCLUDED_COLUMNS: readonly string[] = [
  "checkbox",
  "alertMenu",
  "noise",
];

/** Columns the widget keeps pinned to the left edge. */
export const WIDGET_PINNED_LEFT: readonly string[] = [
  "severity",
  "status",
  "source",
];

/** Widget width in pixels below which the widget switches to its narrow layout. */
export const NARROW_WIDGET_PX = 420;

/** Ids of the fixed alert table columns the widget can show, without the excluded ones. */
export const WIDGET_STATIC_COLUMN_IDS = [
  "severity",
  "status",
  "source",
  "name",
  "description",
  "lastReceived",
  "assignee",
  "extraPayload",
] as const;

/** Fixed display columns with no value to group rows by. */
export const WIDGET_UNGROUPABLE_COLUMN_IDS: readonly string[] = [
  "severity",
  "extraPayload",
];

/** A partial update to a widget's column state. */
export type WidgetColumnChange = {
  columnOrder?: string[];
  visibleColumns?: string[];
  columnRenameMapping?: Record<string, string>;
  columnSizing?: Record<string, number>;
  groupBy?: string | null;
  emptyGroupPosition?: EmptyGroupPosition;
};

/**
 * Maps a saved column id to the id the table uses.
 *
 * An id the table knows is kept. Otherwise an undotted id falls back to its
 * camelCase form when the table knows that, so legacy facet ids such as
 * `last_received` resolve to `lastReceived`. Dotted ids never fall back, because
 * their segments are user-defined label names. An id nothing matches is kept.
 */
export function resolveWidgetColumnId(
  id: string,
  knownIds: ReadonlySet<string>
): string {
  if (knownIds.has(id) || id.includes(".")) {
    return id;
  }
  const camelCaseId = camelCase(id);
  return knownIds.has(camelCaseId) ? camelCaseId : id;
}

/**
 * Returns the ids of the columns a widget shows, in display order.
 *
 * Reads `presetColumns`, or the widget defaults when it is unset, resolves each
 * id, drops the excluded columns and keeps the first occurrence of a duplicate.
 */
export function getVisibleColumnIds(
  item: WidgetData,
  knownIds: ReadonlySet<string>
): string[] {
  const visible = new Set<string>();
  (item.presetColumns ?? defaultColumns).forEach((id) => {
    const resolved = resolveWidgetColumnId(id, knownIds);
    if (!WIDGET_EXCLUDED_COLUMNS.includes(resolved)) {
      visible.add(resolved);
    }
  });
  return Array.from(visible);
}

/**
 * Reconciles a saved column order with the columns that exist.
 *
 * Drops ids that are not in `allIds` or repeat, then appends the missing ids in
 * `allIds` order.
 */
export function normalizeColumnOrder(
  order: readonly string[],
  allIds: readonly string[]
): string[] {
  const known = new Set(allIds);
  const normalized = new Set(order.filter((id) => known.has(id)));
  allIds.forEach((id) => normalized.add(id));
  return Array.from(normalized);
}

/**
 * Applies a reordering of the visible columns to the full column order.
 *
 * The slots the visible ids occupy in `fullOrder` are refilled with
 * `visibleOrder` in sequence, so hidden ids keep their positions and the
 * visible ids read in `visibleOrder`. Ids left over once those slots are
 * filled are appended.
 */
export function mergeVisibleColumnOrder(
  fullOrder: readonly string[],
  visibleOrder: readonly string[]
): string[] {
  const visible = new Set(visibleOrder);
  const remaining = [...visibleOrder];
  const merged = fullOrder.map((id) =>
    visible.has(id) ? (remaining.shift() as string) : id
  );
  return [...merged, ...remaining];
}

/** Builds a table visibility state with an explicit flag for every id in `allIds`. */
export function toVisibilityState(
  visibleIds: readonly string[],
  allIds: readonly string[]
): VisibilityState {
  const visible = new Set(visibleIds);
  const state: VisibilityState = {};
  allIds.forEach((id) => {
    state[id] = visible.has(id);
  });
  return state;
}

/**
 * Turns a table visibility state back into an ordered list of visible ids.
 *
 * Previously visible ids keep their order unless the state hides them. Ids the
 * state newly shows are appended in the state's key order.
 */
export function visibleIdsFromVisibilityState(
  next: VisibilityState,
  previousVisible: readonly string[]
): string[] {
  const visible = new Set(previousVisible.filter((id) => next[id] !== false));
  Object.keys(next).forEach((id) => {
    if (next[id] === true) {
      visible.add(id);
    }
  });
  return Array.from(visible);
}

/**
 * Returns a copy of the widget with a column change applied.
 *
 * `visibleColumns` is written to `presetColumns`. Every other defined key is
 * merged into `alertTable`, keeping the keys the change does not mention.
 */
export function applyWidgetColumnChange(
  item: WidgetData,
  change: WidgetColumnChange
): WidgetData {
  const { visibleColumns, ...tableChange } = change;
  const next: WidgetData = { ...item };
  if (visibleColumns !== undefined) {
    next.presetColumns = visibleColumns;
  }
  const definedChange = Object.fromEntries(
    Object.entries(tableChange).filter(([, value]) => value !== undefined)
  ) as AlertTableWidgetConfig;
  if (Object.keys(definedChange).length > 0) {
    next.alertTable = { ...item.alertTable, ...definedChange };
  }
  return next;
}

/** Returns a copy of the widget with its column customizations removed. */
export function resetWidgetColumns(item: WidgetData): WidgetData {
  const next: WidgetData = { ...item };
  delete next.presetColumns;
  delete next.alertTable;
  return next;
}
