import {
  CHANGE_ALERT_STATUS_KIND,
  ChangeAlertStatusPayload,
  DraftAlert,
  DraftView,
  TARGET_STATUSES,
  TargetStatus,
} from "@/entities/assistant";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown) => typeof value === "string";

const isListOf = (value: unknown, isItem: (item: unknown) => boolean) =>
  Array.isArray(value) && value.every(isItem);

const hasFingerprint = (value: unknown) =>
  isObject(value) && isString(value.fingerprint);

/**
 * The payload of a status-change draft, or null when this build cannot show
 * all of it: another kind, a newer version, or a shape it does not know.
 */
export function parseStatusChangePayload(
  draft: Pick<DraftView, "kind" | "payload">
): ChangeAlertStatusPayload | null {
  const payload: unknown = draft.payload;
  const isKnown =
    draft.kind === CHANGE_ALERT_STATUS_KIND &&
    isObject(payload) &&
    payload.version === 1 &&
    TARGET_STATUSES.includes(payload.target_status as TargetStatus) &&
    (payload.note === null || isString(payload.note)) &&
    typeof payload.dispose_on_new_alert === "boolean" &&
    isListOf(payload.alerts, hasFingerprint) &&
    isListOf(payload.skipped, hasFingerprint) &&
    isListOf(payload.not_found, isString) &&
    isListOf(payload.unresolvable, isString);
  return isKnown ? (payload as unknown as ChangeAlertStatusPayload) : null;
}

export interface FromStatusGroup {
  /** Null when Keep does not know the alerts' status. */
  status: string | null;
  count: number;
}

/** How many alerts change from which status, in the order they are listed. */
export function groupByFromStatus(alerts: DraftAlert[]): FromStatusGroup[] {
  const counts = new Map<string | null, number>();
  alerts.forEach(({ from_status: status }) => {
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });
  return Array.from(counts, ([status, count]) => ({ status, count }));
}

/** How many alerts lose the note they have. */
export function countReplacedNotes({
  note,
  alerts,
}: Pick<ChangeAlertStatusPayload, "note" | "alerts">): number {
  return note ? alerts.filter((alert) => alert.has_note).length : 0;
}

/**
 * Whether the change may resolve an incident too. Only for alerts that are
 * known to have one: a read by fingerprint cannot tell.
 */
export function mayResolveIncident({
  target_status: target,
  alerts,
}: Pick<ChangeAlertStatusPayload, "target_status" | "alerts">): boolean {
  return (
    target === "resolved" && alerts.some((alert) => alert.has_incident === true)
  );
}

export function formatAlertCount(count: number): string {
  return `${count} ${count === 1 ? "alert" : "alerts"}`;
}

/** The exact change, as the label of the button that makes it. */
export function getConfirmLabel({
  target_status: target,
  alerts,
}: Pick<ChangeAlertStatusPayload, "target_status" | "alerts">): string {
  const count = formatAlertCount(alerts.length);
  switch (target) {
    case "acknowledged":
      return `Acknowledge ${count}`;
    case "resolved":
      return `Resolve ${count}`;
    case "suppressed":
      return `Suppress ${count}`;
    case "firing":
      return `Set ${count} to firing`;
  }
}
