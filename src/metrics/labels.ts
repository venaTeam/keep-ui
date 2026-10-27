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

// Bounded HTTP status-code labels for error metrics (powers the "UI error
// codes" pie chart). Any code outside this allow-list collapses to "other" so
// cardinality stays bounded.
export const STATUS_CODE_LABELS = [
  "400",
  "401",
  "403",
  "404",
  "409",
  "422",
  "429",
  "500",
  "502",
  "503",
  "504",
  "other",
] as const;

export type StatusCodeLabel = (typeof STATUS_CODE_LABELS)[number];

const ACTION_SET: ReadonlySet<string> = new Set(ACTION_LABELS);
const PAGE_SET: ReadonlySet<string> = new Set(PAGE_LABELS);
const STATUS_CODE_SET: ReadonlySet<string> = new Set(STATUS_CODE_LABELS);

export function isValidAction(value: unknown): value is ActionLabel {
  return typeof value === "string" && ACTION_SET.has(value);
}

export function isValidPage(value: unknown): value is PageLabel {
  return typeof value === "string" && PAGE_SET.has(value);
}

// Normalize an arbitrary client-supplied status code to a bounded label.
// Unknown / missing codes bucket to "other".
export function normalizeStatusCode(value: unknown): StatusCodeLabel {
  const code = typeof value === "number" ? String(value) : value;
  return typeof code === "string" && STATUS_CODE_SET.has(code)
    ? (code as StatusCodeLabel)
    : "other";
}
