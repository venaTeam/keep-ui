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
 * Returns the column a widget's saved `groupBy` names, resolved like a
 * visible column, or undefined when it is not grouped.
 */
export function getGroupByColumnId(item: WidgetData): string | undefined {
  const groupBy = item.alertTable?.groupBy;
  return groupBy ? resolveWidgetColumnId(groupBy) : undefined;
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
 * The camelCase aliases the gateway's alert DTO (`AlertDto` in keep-api-gateway
 * `src/models/alert.py`) declares for its snake_case fields, which is how the
 * alerts arrive. The facet list can name these fields in snake_case
 * (`firing_counter`), so a saved id may use either form.
 */
export const WIDGET_ALERT_FIELD_ALIASES: readonly string[] = [
  "lastReceived",
  "firingStartTime",
  "firingStartTimeSinceLastResolved",
  "firingCounter",
  "unresolvedCounter",
  "isFullDuplicate",
  "isPartialDuplicate",
  "duplicateReason",
  "dismissUntil",
  "providerId",
  "providerType",
  "startedAt",
];

/**
 * The column ids a saved snake_case id can resolve to: the widget's fixed
 * columns, the alert's known keys (`AlertKnownKeys`) and
 * `WIDGET_ALERT_FIELD_ALIASES`. It never depends on the loaded alerts.
 */
export const WIDGET_KNOWN_COLUMN_IDS: ReadonlySet<string> = new Set<string>([
  ...WIDGET_STATIC_COLUMN_IDS,
  ...AlertKnownKeys,
  ...WIDGET_ALERT_FIELD_ALIASES,
]);

/**
 * Maps a saved column id to the id the table uses.
 *
 * An id in `WIDGET_KNOWN_COLUMN_IDS` is kept. Otherwise an undotted id falls
 * back to its camelCase form when that is in `WIDGET_KNOWN_COLUMN_IDS`, so
 * facet ids such as `last_received` or `firing_counter` resolve to
 * `lastReceived` and `firingCounter`. Dotted ids never fall back, because
 * their segments are user-defined label names. Any other id is kept, so a
 * custom enrichment key stays as it is. The result depends only on the id,
 * never on the loaded alerts, so a saved id always names the same column.
 */
export function resolveWidgetColumnId(id: string): string {
  if (WIDGET_KNOWN_COLUMN_IDS.has(id) || id.includes(".")) {
    return id;
  }
  const camelCaseId = camelCase(id);
  return WIDGET_KNOWN_COLUMN_IDS.has(camelCaseId) ? camelCaseId : id;
}

/**
 * Maps field ids from the facet list (and other extra fields) to the column
 * ids the widget uses, each through `resolveWidgetColumnId`, so the ⚙ panel
 * and the widget form offer and save the ids the widget reads.
 */
export function resolveFieldIds(fields: readonly string[]): string[] {
  return fields.map(resolveWidgetColumnId);
}

/**
 * Returns the ids of the columns a widget shows, in display order.
 *
 * Reads `presetColumns`, or the widget defaults when it is unset, resolves each
 * id, drops the excluded columns and keeps the first occurrence of a duplicate.
 */
export function getVisibleColumnIds(item: WidgetData): string[] {
  const visible = new Set<string>();
  (item.presetColumns ?? defaultColumns).forEach((id) => {
    const resolved = resolveWidgetColumnId(id);
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
