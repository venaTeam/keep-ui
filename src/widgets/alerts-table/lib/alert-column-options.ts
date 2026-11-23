import { startCase } from "lodash";
import type { AlertDto } from "@/entities/alerts/model/types";
import { COUNT_BY_ALERT_FIELD_OPTIONS } from "@/entities/presets/model/count-by";

/**
 * Enrichment fields offered as columns even when no loaded alert carries
 * them yet.
 */
export const COMMON_ENRICHMENT_FIELDS: readonly string[] = [
  "ticket_id",
  "ticket_url",
  "ticket_type",
  "ticket_status",
  "environment",
  "service",
  "region",
  "cluster",
  "namespace",
  "pod",
  "container",
  "host",
  "instance",
  "application",
  "component",
  "object",
  "site",
  "impact",
  "team",
  "owner",
  "runbook_url",
  "alert_rule_url",
  "dashboard_url",
  "logs_url",
  "metrics_url",
  "impacted_customer_name",
  "severity_override",
  "priority",
  "escalation_policy",
  "on_call_engineer",
  "alert_enrichment",
];

/**
 * Fields the Group rows by select lists first: Incident, the Count control's
 * field options in their order, then Source and Status. It is built from
 * `COUNT_BY_ALERT_FIELD_OPTIONS` so both controls share field ids and labels.
 * Severity is left out: it is a display column with no value to group by.
 */
export const GROUP_BY_SHORTLIST: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "incident", label: "Incident" },
  ...COUNT_BY_ALERT_FIELD_OPTIONS,
  { value: "source", label: "Source" },
  { value: "status", label: "Status" },
];

/**
 * Alert fields the Group rows by select lists after the shortlist, besides the
 * widget's own columns: `AlertDto` fields whose values repeat across alerts,
 * so each group gathers several of them. The other `AlertDto` fields are left
 * out on purpose:
 * - per-alert unique ids (`id`, `event_id`, `fingerprint`,
 *   `alert_fingerprint`) and timestamps, which give nearly every alert a group
 *   of its own;
 * - URLs and free text (`description`, `note`), which rarely repeat;
 * - lists (`enriched_fields`; `source` is a list too and sits in the
 *   shortlist), whose loaded values cannot group rows;
 * - internal flags such as `pushed` and `deleted`, which say nothing an
 *   operator groups by;
 * - severity, a display column with no value to group by.
 */
export const GROUPABLE_ALERT_FIELDS: ReadonlyArray<keyof AlertDto> = [
  "environment",
  "component",
  "object",
  "impact",
  "group",
  "providerId",
  "ticket_status",
  "ticket_type",
  "dismiss_mode",
];

const EXCLUDED_COLUMN_IDS: ReadonlySet<string> = new Set([
  "checkbox",
  "alertMenu",
  "noise",
]);

/** Label of each `GROUP_BY_SHORTLIST` field, keyed by field id. */
export const GROUP_BY_SHORTLIST_LABELS: ReadonlyMap<string, string> = new Map(
  GROUP_BY_SHORTLIST.map((option) => [option.value, option.label])
);

/** Tells whether `text` contains `query`, ignoring case. */
export function matchesSearch(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

const KEYWORD_SUFFIX = ".keyword";

/**
 * Fields whose id or label contains `query`, ignoring case, for the Find a
 * field list. A `<field>.keyword` id is left out when `<field>` is listed too,
 * since it is a copy of the same value. Top-level fields come before nested
 * ones such as `labels.*`; the given order is kept otherwise.
 */
export function searchFields(
  fieldIds: readonly string[],
  query: string
): string[] {
  const listed = new Set(fieldIds);
  const isTopLevel = (id: string) => !id.includes(".");
  return fieldIds
    .filter(
      (id) =>
        !(
          id.endsWith(KEYWORD_SUFFIX) &&
          listed.has(id.slice(0, -KEYWORD_SUFFIX.length))
        ) &&
        (matchesSearch(id, query) || matchesSearch(getColumnLabel(id), query))
    )
    .sort(
      (first, second) => Number(isTopLevel(second)) - Number(isTopLevel(first))
    );
}

/**
 * Column ids a user can add, show or group by: the table's columns plus the
 * extra fields, de-duplicated, without the checkbox, menu and noise columns,
 * sorted alphabetically.
 */
export function getAlertColumnOptions(
  tableColumnIds: readonly string[],
  extraFields: readonly string[]
): string[] {
  return Array.from(new Set([...tableColumnIds, ...extraFields]))
    .filter((id) => !EXCLUDED_COLUMN_IDS.has(id))
    .sort((first, second) => first.localeCompare(second));
}

/**
 * Fields the Group rows by select lists after the shortlist: the
 * `GROUPABLE_ALERT_FIELDS` and the given widget columns, de-duplicated,
 * without the checkbox, menu and noise columns, sorted alphabetically. The
 * tenant's potential fields are not offered: that list can hold thousands of
 * names, and listing them all froze the select.
 */
export function getGroupByFieldOptions(columnIds: readonly string[]): string[] {
  return getAlertColumnOptions(columnIds, GROUPABLE_ALERT_FIELDS);
}

/**
 * Column labels that differ from the id in start case. The Count and Group
 * rows by wording is kept out: it calls `node_name` "Host", which clashed with
 * the separate `host` field, so columns use the presets page's names.
 */
const COLUMN_LABELS: ReadonlyMap<string, string> = new Map([
  ["name", "Alert name"],
]);

/**
 * Display label of a column: its rename when one is set, else its entry in
 * `COLUMN_LABELS`, else the id in start case (`labels.team` reads "Labels
 * Team", `node_name` reads "Node Name").
 */
export function getColumnLabel(
  columnId: string,
  renameMapping?: Record<string, string>
): string {
  const renamed =
    renameMapping &&
    Object.prototype.hasOwnProperty.call(renameMapping, columnId)
      ? renameMapping[columnId]
      : undefined;
  if (typeof renamed === "string" && renamed !== "") {
    return renamed;
  }
  return COLUMN_LABELS.get(columnId) ?? startCase(columnId);
}
