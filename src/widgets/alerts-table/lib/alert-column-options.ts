import { startCase } from "lodash";
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

const EXCLUDED_COLUMN_IDS: ReadonlySet<string> = new Set([
  "checkbox",
  "alertMenu",
  "noise",
]);

const SHORTLIST_LABELS: ReadonlyMap<string, string> = new Map(
  GROUP_BY_SHORTLIST.map((option) => [option.value, option.label])
);

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
 * Display label of a column: its rename when one is set, else the shortlist
 * label, else the id in start case (`labels.team` reads "Labels Team").
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
  return SHORTLIST_LABELS.get(columnId) ?? startCase(columnId);
}
