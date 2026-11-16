import { camelCase } from "lodash";
import type { VisibilityState } from "@tanstack/react-table";
import { AlertKnownKeys } from "@/entities/alerts/model/types";
import type {
  AlertTableWidgetConfig,
  EmptyGroupPosition,
  WidgetData,
} from "../../types";
import { defaultColumns } from "./constants";

export type { AlertTableWidgetConfig, EmptyGroupPosition };

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
export const NARROW_WIDGET_PX = 320;

/**
 * Widget width in pixels below which the rows' quick-action trays show icons
 * only; the labelled tray is about 316 px wide and would cover most of a
 * narrower row.
 */
export const QUICK_TRAY_COMPACT_PX = 640;

/**
 * Minimum widths, in pixels, the widget uses instead of the presets-page ones,
 * so a default-size widget fits its default columns.
 */
export const WIDGET_COLUMN_MIN_SIZE: ReadonlyMap<string, number> = new Map([
  ["name", 100],
  ["description", 100],
]);

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

/**
 * Returns the column a widget's saved `groupBy` names, resolved against
 * `knownIds` like a visible column, or undefined when it is not grouped.
 */
export function getGroupByColumnId(
  item: WidgetData,
  knownIds: ReadonlySet<string>
): string | undefined {
  const groupBy = item.alertTable?.groupBy;
  return groupBy ? resolveWidgetColumnId(groupBy, knownIds) : undefined;
}

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
 * Returns the ids a saved column id can resolve to: the widget's fixed columns,
 * the alert's known keys (`AlertKnownKeys`, such as `duplicateReason`) and
 * `loadedIds`, the field keys and generated column ids of the loaded alerts.
 * Without `loadedIds` it is what a widget knows before any alert loads.
 */
export function getKnownColumnIds(
  loadedIds: Iterable<string> = []
): ReadonlySet<string> {
  return new Set<string>([
    ...WIDGET_STATIC_COLUMN_IDS,
    ...AlertKnownKeys,
    ...loadedIds,
  ]);
}

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
 * Maps field ids from the facet list (and other extra fields) to the column
 * ids the widget uses, each through `resolveWidgetColumnId` against
 * `getKnownColumnIds(columnIds)`. The ⚙ panel passes the widget's columns;
 * the widget form, which has no loaded alerts, passes none, and the widget
 * resolves what is left when it reads the saved setting.
 */
export function resolveFieldIds(
  fields: readonly string[],
  columnIds: Iterable<string> = []
): string[] {
  const knownIds = getKnownColumnIds(columnIds);
  return fields.map((id) => resolveWidgetColumnId(id, knownIds));
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

function isUnsetValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return typeof value === "object" && Object.keys(value).length === 0;
}

function compactAlertTable(
  config: AlertTableWidgetConfig
): AlertTableWidgetConfig | undefined {
  const compacted = Object.fromEntries(
    Object.entries(config).filter(([, value]) => !isUnsetValue(value))
  ) as AlertTableWidgetConfig;
  if ("groupBy" in config && compacted.groupBy === undefined) {
    delete compacted.emptyGroupPosition;
  }
  return Object.keys(compacted).length > 0 ? compacted : undefined;
}

/**
 * Returns a copy of the widget with a column change applied.
 *
 * `visibleColumns` is written to `presetColumns`. Every other defined key is
 * merged into `alertTable`, keeping the keys the change does not mention.
 * Settings that end up null, empty or unset are removed, so are the empty
 * group's position when the grouping is cleared and `alertTable` itself when
 * nothing is left in it. Undoing a change therefore leaves the widget as if it
 * had never been customized.
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
    const alertTable = compactAlertTable({
      ...item.alertTable,
      ...definedChange,
    });
    if (alertTable) {
      next.alertTable = alertTable;
    } else {
      delete next.alertTable;
    }
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
