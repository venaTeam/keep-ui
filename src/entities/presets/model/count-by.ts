export type CountByField =
  | "incident"
  | "name"
  | "service"
  | "node_name"
  | "application"
  | "site"
  | "assignee";

export type CountByAlertField = Exclude<CountByField, "incident">;

export type IncidentStatusFilter = "active" | "firing" | "acknowledged";

export interface CountBy {
  field: CountByField;
  incidentStatus?: IncidentStatusFilter;
}

export type CountMode = "alerts" | "incidents" | "field";

export const DEFAULT_INCIDENT_STATUS: IncidentStatusFilter = "active";

export const COUNT_LOAD_ERROR_LABEL = "Couldn't load count";

export const INCIDENT_STATUS_OPTIONS: ReadonlyArray<{
  value: IncidentStatusFilter;
  label: string;
}> = [
  { value: "active", label: "Active (firing + acknowledged)" },
  { value: "firing", label: "Firing only" },
  { value: "acknowledged", label: "Acknowledged only" },
];

const ALERT_FIELD_LABELS: Record<
  CountByAlertField,
  { option: string; singular: string; plural: string }
> = {
  name: { option: "Alert name", singular: "Alert name", plural: "Alert names" },
  service: { option: "Service", singular: "Service", plural: "Services" },
  node_name: { option: "Host", singular: "Host", plural: "Hosts" },
  application: {
    option: "Application",
    singular: "Application",
    plural: "Applications",
  },
  site: { option: "Site", singular: "Site", plural: "Sites" },
  assignee: { option: "Assignee", singular: "Assignee", plural: "Assignees" },
};

const INCIDENT_LABELS: Record<
  IncidentStatusFilter,
  { singular: string; plural: string }
> = {
  active: { singular: "Active incident", plural: "Active incidents" },
  firing: { singular: "Firing incident", plural: "Firing incidents" },
  acknowledged: {
    singular: "Acknowledged incident",
    plural: "Acknowledged incidents",
  },
};

export const COUNT_BY_ALERT_FIELD_OPTIONS: ReadonlyArray<{
  value: CountByAlertField;
  label: string;
}> = (Object.keys(ALERT_FIELD_LABELS) as CountByAlertField[]).map((value) => ({
  value,
  label: ALERT_FIELD_LABELS[value].option,
}));

export function getCountMode(countBy?: CountBy): CountMode {
  if (!countBy) {
    return "alerts";
  }
  return countBy.field === "incident" ? "incidents" : "field";
}

const hasOwnKey = <T extends object>(
  record: T,
  key: PropertyKey
): key is keyof T => Object.prototype.hasOwnProperty.call(record, key);

/**
 * Caption for the counted unit. A saved setting the UI does not know (a field
 * or status outside the allowlist) falls back to a generic label instead of
 * throwing, so one stale widget cannot take the dashboard down.
 */
export function getCountUnitLabel(countBy: CountBy, count: number): string {
  const isSingular = count === 1;
  if (countBy.field === "incident") {
    const status = countBy.incidentStatus ?? DEFAULT_INCIDENT_STATUS;
    if (!hasOwnKey(INCIDENT_LABELS, status)) {
      return isSingular ? "Incident" : "Incidents";
    }
    const labels = INCIDENT_LABELS[status];
    return isSingular ? labels.singular : labels.plural;
  }
  const field: string = countBy.field;
  if (!hasOwnKey(ALERT_FIELD_LABELS, field)) {
    return field;
  }
  const labels = ALERT_FIELD_LABELS[field];
  return isSingular ? labels.singular : labels.plural;
}
