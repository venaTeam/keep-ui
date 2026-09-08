export const LOCALSTORAGE_THEME_KEY = "theme";

export const DOCS_CLIPBOARD_COPY_ERROR_PATH =
  "/overview/faq#1-“failed-to-copy-alert%2Ffingerprint-please-check-your-browser-permissions”";

// Cross-tab SSE connection sharing (see utils/hooks/sseConnectionManager.ts).
export const SSE_LEADER_LOCK_NAME = "keep-sse-leader";
export const SSE_BROADCAST_CHANNEL_NAME = "keep-sse";
export const SSE_BROADCAST_KIND = "keep-sse-event";
export const SSE_LEADER_STATE_KIND = "keep-sse-leader-state";
export const SSE_STALE_AFTER_MS = 45_000;
export const SSE_WATCHDOG_INTERVAL_MS = 5_000;
export const SSE_RECONNECT_INITIAL_DELAY_MS = 1_000;
export const SSE_RECONNECT_MAX_DELAY_MS = 30_000;
export const SSE_RECONNECT_JITTER_MS = 250;

// Feed refetch pacing for SSE poll-alerts events, in milliseconds (see
// widgets/alerts-table/lib/refetch-scheduler.ts). The env vars of the same
// names override them at runtime via InternalConfig.
export const ALERT_REFETCH_DEBOUNCE_MS = 800;
export const ALERT_REFETCH_MAX_WAIT_MS = 2000;
