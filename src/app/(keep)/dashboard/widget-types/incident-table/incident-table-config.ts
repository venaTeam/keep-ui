import { valueToString } from "@/features/filter/store/utils";
import { IncidentDto } from "@/entities/incidents/model";
import {
  IncidentTableColumn,
  IncidentTableSeverity,
  IncidentTableStatus,
  IncidentTableWidgetConfig,
  LayoutItem,
} from "../../types";

export const INCIDENT_TABLE_STATUS_OPTIONS: {
  value: IncidentTableStatus;
  label: string;
}[] = [
  { value: "firing", label: "Firing" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "suppressed", label: "Suppressed" },
];

export const INCIDENT_TABLE_SEVERITY_OPTIONS: {
  value: IncidentTableSeverity;
  label: string;
  order: number;
}[] = [
  { value: "critical", label: "Critical", order: 5 },
  { value: "high", label: "High", order: 4 },
  { value: "warning", label: "Warning", order: 3 },
];

export const INCIDENT_TABLE_COLUMNS: {
  id: IncidentTableColumn;
  header: string;
}[] = [
  { id: "status", header: "Status" },
  { id: "severity", header: "Severity" },
  { id: "name", header: "Name" },
  { id: "description", header: "Description" },
  { id: "alertsCount", header: "Alerts" },
  { id: "creationTime", header: "Created" },
  { id: "snLink", header: "SN Link" },
];

export const INCIDENT_TABLE_LIMIT_MIN = 1;
export const INCIDENT_TABLE_LIMIT_MAX = 50;

export const DEFAULT_INCIDENT_TABLE_CONFIG: IncidentTableWidgetConfig = {
  statuses: INCIDENT_TABLE_STATUS_OPTIONS.map((option) => option.value),
  severities: INCIDENT_TABLE_SEVERITY_OPTIONS.map((option) => option.value),
  columns: INCIDENT_TABLE_COLUMNS.map((column) => column.id),
  limit: 10,
};

export const INCIDENT_TABLE_NEW_WIDGET_LAYOUT: Partial<LayoutItem> = {
  w: 16,
  h: 11,
  minW: 0,
  minH: 2,
  static: false,
};

const TICKET_KEYS = [
  { url: "servicenow_ticket_url", id: "servicenow_ticket_id" },
  { url: "ticketing_ticket_url", id: "ticketing_ticket_id" },
] as const;

const selectedStatuses = (config: IncidentTableWidgetConfig) =>
  INCIDENT_TABLE_STATUS_OPTIONS.filter((option) =>
    config.statuses.includes(option.value)
  );

const selectedSeverities = (config: IncidentTableWidgetConfig) =>
  INCIDENT_TABLE_SEVERITY_OPTIONS.filter((option) =>
    config.severities.includes(option.value)
  );

/**
 * Builds the CEL the Incidents page uses for the same status and severity
 * selection, always excluding candidate incidents.
 */
export function buildIncidentTableCel(
  config: IncidentTableWidgetConfig
): string {
  const statuses = selectedStatuses(config)
    .map((option) => valueToString(option.value))
    .join(", ");
  const severities = selectedSeverities(config)
    .map((option) => option.order)
    .join(", ");
  return `is_candidate == false && status in [${statuses}] && severity in [${severities}]`;
}

/**
 * Builds the Incidents page URL whose facet panel starts with the widget's
 * status and severity selection. Severity numbers are encoded as quoted
 * strings because the severity facet's options carry string values.
 */
export function buildIncidentsPageUrl(
  config: IncidentTableWidgetConfig
): string {
  const params = new URLSearchParams();
  params.set(
    "facet_status",
    selectedStatuses(config)
      .map((option) => valueToString(option.value))
      .join(",")
  );
  params.set(
    "facet_severity",
    selectedSeverities(config)
      .map((option) => valueToString(String(option.order)))
      .join(",")
  );
  return `/incidents?${params.toString()}`;
}

/**
 * Returns an error message for each part of the config that is not usable.
 */
export function validateIncidentTableConfig(
  config: IncidentTableWidgetConfig
): Partial<Record<"statuses" | "severities" | "columns" | "limit", string>> {
  const errors: Partial<
    Record<"statuses" | "severities" | "columns" | "limit", string>
  > = {};
  if (config.statuses.length === 0) {
    errors.statuses = "Select at least one status";
  }
  if (config.severities.length === 0) {
    errors.severities = "Select at least one severity";
  }
  if (config.columns.length === 0) {
    errors.columns = "Select at least one column";
  }
  if (
    !Number.isInteger(config.limit) ||
    config.limit < INCIDENT_TABLE_LIMIT_MIN ||
    config.limit > INCIDENT_TABLE_LIMIT_MAX
  ) {
    errors.limit = `Enter a whole number from ${INCIDENT_TABLE_LIMIT_MIN} to ${INCIDENT_TABLE_LIMIT_MAX}`;
  }
  return errors;
}

/**
 * Sorts the chosen columns into the table's fixed column order.
 */
export function orderIncidentTableColumns(
  columns: IncidentTableColumn[]
): IncidentTableColumn[] {
  return INCIDENT_TABLE_COLUMNS.map((column) => column.id).filter((id) =>
    columns.includes(id)
  );
}

function readIncidentField(
  incident: IncidentDto,
  key: string
): string | undefined {
  const sources = [
    incident.enrichments?.[key],
    (incident as unknown as Record<string, unknown>)[key],
  ];
  const found = sources.find(
    (value) =>
      (typeof value === "string" && value.trim() !== "") ||
      typeof value === "number"
  );
  return found === undefined ? undefined : String(found);
}

/**
 * Finds the ticket linked to an incident, preferring ServiceNow over the
 * generic ticketing fields. The label is the ticket id, or "Open" without one.
 */
export function getIncidentTicketLink(
  incident: IncidentDto
): { url: string; label: string } | null {
  for (const key of TICKET_KEYS) {
    const url = readIncidentField(incident, key.url);
    if (url) {
      return { url, label: readIncidentField(incident, key.id) ?? "Open" };
    }
  }
  return null;
}

const WORD_BREAKING_ELEMENTS =
  "br, hr, p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, pre, table, tr, td, th, section, article";

/**
 * Reduces an HTML fragment to its visible text with whitespace collapsed.
 * Line breaks and block elements separate words, inline elements do not.
 */
export function toPlainText(html: string | null | undefined): string {
  if (!html) {
    return "";
  }
  if (typeof DOMParser === "undefined") {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style").forEach((node) => node.remove());
  doc.querySelectorAll(WORD_BREAKING_ELEMENTS).forEach((node) => {
    node.before(" ");
    node.after(" ");
  });
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Summarises the status and severity selection, for example
 * "Firing, Acknowledged · Critical".
 */
export function describeIncidentTableFilters(
  config: IncidentTableWidgetConfig
): string {
  const statuses = selectedStatuses(config)
    .map((option) => option.label)
    .join(", ");
  const severities = selectedSeverities(config)
    .map((option) => option.label)
    .join(", ");
  return `${statuses} · ${severities}`;
}
