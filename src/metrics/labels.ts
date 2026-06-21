// Canonical, server-side allow-lists for keep-ui metric labels.
//
// These act as a cardinality firewall: ingestion routes validate any
// client-supplied label against these sets and reject unknown values,
// preventing both label spoofing and unbounded-cardinality injection.
//
// Keep this list in sync with the actual call sites in
// `src/utils/metrics/index.ts` and the UI components that emit metrics.

// Product action labels. `create_preset` and `timeline_loading` were pruned:
// they had no callers (dead labels).
export const ACTION_LABELS = [
  "change_status",
  "self_assign",
  "dismiss_alert",
  "create_incident",
  "create_dashboard",
  "add_note",
] as const;

export type ActionLabel = (typeof ACTION_LABELS)[number];

// Bounded page-view labels. Free-text / per-entity labels (e.g. `preset:<name>`)
// are intentionally excluded — those collapse to a single bounded label
// (`alerts_preset`) at the call site.
export const PAGE_LABELS = [
  "incidents",
  "incidents_detail",
  "alerts_feed",
  "alerts_preset",
  "alerts_detail",
  "dashboard",
  "dashboard_detail",
] as const;

export type PageLabel = (typeof PAGE_LABELS)[number];

const ACTION_SET: ReadonlySet<string> = new Set(ACTION_LABELS);
const PAGE_SET: ReadonlySet<string> = new Set(PAGE_LABELS);

export function isValidAction(value: unknown): value is ActionLabel {
  return typeof value === "string" && ACTION_SET.has(value);
}

export function isValidPage(value: unknown): value is PageLabel {
  return typeof value === "string" && PAGE_SET.has(value);
}
