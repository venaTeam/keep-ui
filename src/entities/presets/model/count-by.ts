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
  showMissing?: boolean;
}

export type CountMode = "alerts" | "incidents" | "field";

export const DEFAULT_INCIDENT_STATUS: IncidentStatusFilter = "active";

export const COUNT_LOAD_ERROR_LABEL = "Couldn't load count";

export const UNKNOWN_COUNT_FIELD_LABEL = "Unknown field";

export const MISSING_UNAVAILABLE_LABEL = "—";

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
 * throwing, so one stale widget cannot take the dashboard down. A field that
 * is not a string at all cannot be rendered, so it gets a fixed label.
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
  const field: unknown = countBy.field;
  if (typeof field !== "string") {
    return UNKNOWN_COUNT_FIELD_LABEL;
  }
  if (!hasOwnKey(ALERT_FIELD_LABELS, field)) {
    return field;
  }
  const labels = ALERT_FIELD_LABELS[field];
  return isSingular ? labels.singular : labels.plural;
}

const MISSING_FIELD_NOUNS: Record<
  CountByAlertField,
  { noun: string; article: "a" | "an" }
> = {
  name: { noun: "alert name", article: "an" },
  service: { noun: "service", article: "a" },
  node_name: { noun: "host", article: "a" },
  application: { noun: "application", article: "an" },
  site: { noun: "site", article: "a" },
  assignee: { noun: "assignee", article: "an" },
};

const MISSING_VALUE_NOUN = { noun: "value", article: "a" as const };

const getMissingFieldNoun = (countBy: CountBy) => {
  const field: unknown = countBy.field;
  if (typeof field !== "string") {
    return MISSING_VALUE_NOUN;
  }
  if (hasOwnKey(MISSING_FIELD_NOUNS, field)) {
    return MISSING_FIELD_NOUNS[field];
  }
  return { noun: field, article: "a" as const };
};

/** Whether a widget asked to show the alerts its count leaves out. */
export function isShowingMissing(countBy?: CountBy): boolean {
  return countBy?.showMissing === true;
}

/** Label of the form switch that shows the alerts a count leaves out. */
export function getMissingToggleLabel(countBy: CountBy): string {
  if (countBy.field === "incident") {
    return "Show alerts not in an incident";
  }
  return `Show alerts with no ${getMissingFieldNoun(countBy).noun}`;
}

/** Help line under that switch. */
export function getMissingToggleHelp(countBy: CountBy): string {
  if (countBy.field === "incident") {
    return "Adds how many matching alerts aren't in any incident.";
  }
  return `Adds how many matching alerts have no ${getMissingFieldNoun(countBy).noun}.`;
}

/**
 * Text for the number of matching alerts with no incident, or no value for
 * the counted field. Zero says that every alert is covered instead.
 */
export function getMissingCountLabel(countBy: CountBy, missing: number): string {
  const alerts = missing === 1 ? "alert" : "alerts";
  if (countBy.field === "incident") {
    return missing === 0
      ? "Every alert is in an incident"
      : `+ ${missing} ${alerts} not in an incident`;
  }
  const { noun, article } = getMissingFieldNoun(countBy);
  return missing === 0
    ? `Every alert has ${article} ${noun}`
    : `+ ${missing} ${alerts} with no ${noun}`;
}
