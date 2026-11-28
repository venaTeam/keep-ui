/**
 * The contract of the gateway's `/assistant/*` routes. Mirrors the models in
 * keep-api-gateway `src/services/assistant/`, pinned on both sides by the
 * vendored `__fixtures__/assistant_stream.json`.
 *
 * A newer gateway may send values this build does not list (its `future`
 * fixture section): codes are open, and an unknown event or timeline item is
 * left out where it is read.
 */

/** A value this build knows, or one of a newer gateway. */
export type OrUnknown<T extends string> = T | (string & {});

export const STREAM_EVENT_NAMES = [
  "conversation",
  "text_delta",
  "tool_status",
  "draft",
  "error",
  "done",
  "link",
] as const;
export type StreamEventName = (typeof STREAM_EVENT_NAMES)[number];

export const TOOL_PHASES = ["started", "finished"] as const;
export type ToolPhase = (typeof TOOL_PHASES)[number];

export const TOOL_OUTCOMES = [
  "draft_created",
  "too_many_matches",
  "no_matches",
  "nothing_to_change",
  "invalid_cel",
  "invalid_arguments",
  "unauthenticated",
  "error",
  "found",
  "not_found",
  "link_ready",
  "name_taken",
  // A call past the turn's tool calls, which did not run
  "tool_limit",
] as const;
export type ToolOutcome = (typeof TOOL_OUTCOMES)[number];

export const STREAM_ERROR_CODES = [
  "llm_unavailable",
  "llm_rejected",
  "llm_rate_limited",
  "turn_timeout",
  "gateway_unavailable",
  "unauthenticated",
  "internal",
] as const;
export type StreamErrorCode = (typeof STREAM_ERROR_CODES)[number];

export const FINISH_REASONS = [
  "stop",
  "tool_limit",
  "length",
  "error",
  "cancelled",
] as const;
export type FinishReason = (typeof FINISH_REASONS)[number];

export const DRAFT_STATES = [
  "pending",
  "applying",
  "applied",
  "partially_applied",
  "failed",
  "discarded",
  "expired",
] as const;
export type DraftState = (typeof DRAFT_STATES)[number];

export const TARGET_STATUSES = [
  "firing",
  "acknowledged",
  "resolved",
  "suppressed",
] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];

export const OUTCOME_CODES = [
  "applied",
  "partially_applied",
  "nothing_to_change",
  "unverified",
  "outcome_pending",
  "not_permitted",
  "read_only",
  "failed",
  "interrupted",
  "outcome_unknown",
  "name_taken",
  "object_gone",
  "stale_draft",
  "invalid_filter",
  "opened_in_form",
  "rules_unreadable",
] as const;
export type OutcomeCode = (typeof OUTCOME_CODES)[number];

export const GATEWAY_RESULTS = [
  "ok",
  "failed_response",
  "rejected",
  "rejected_maybe_written",
  "http_error",
  "read_only",
  "not_permitted",
  "unauthenticated",
  "unknown",
  "not_found",
] as const;
export type GatewayResult = (typeof GATEWAY_RESULTS)[number];

export const ALERT_RESULTS = [
  "applied",
  "failed",
  "unconfirmed",
  "skipped",
  "not_found",
] as const;
export type AlertResult = (typeof ALERT_RESULTS)[number];

/** What a draft of an object kind saved. */
export const OBJECT_TYPES = [
  "preset",
  "correlation_rule",
  "dashboard",
] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

export const MESSAGE_STATUSES = ["complete", "interrupted", "error"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const DISCARD_REASONS = ["opened_in_form"] as const;
export type DiscardReason = (typeof DISCARD_REASONS)[number];

/** The pages a link may open (`lib/navigation.ts` has their paths). */
export const LINK_PAGES = [
  "alerts_feed",
  "alerts_preset",
  "alerts_search",
  "incidents",
  "rules",
  "rule",
  "dashboard",
] as const;
export type LinkPage = (typeof LINK_PAGES)[number];

/** The `kind` of a draft made by the status-change tool. */
export const CHANGE_ALERT_STATUS_KIND = "change_alert_status";

export interface DraftAlert {
  fingerprint: string;
  name: string | null;
  severity: string | null;
  from_status: string | null;
  service: string | null;
  source: string | null;
  last_received: string | null;
  /** Null when the read behind it cannot tell. */
  has_incident: boolean | null;
  has_note: boolean;
}

export interface SkippedAlert {
  fingerprint: string;
  name: string | null;
  status: string | null;
}

export interface ChangeAlertStatusPayload {
  version: 1;
  selector:
    | { type: "fingerprints"; fingerprints: string[] }
    | { type: "cel"; cel: string };
  target_status: TargetStatus;
  note: string | null;
  dispose_on_new_alert: boolean;
  matched_count: number;
  alerts: DraftAlert[];
  skipped: SkippedAlert[];
  not_found: string[];
  unresolvable: string[];
}

export interface AlertOutcome {
  fingerprint: string;
  name: string | null;
  result: OrUnknown<AlertResult>;
  status_after: string | null;
}

/** The object a draft saved, or would have saved. */
export interface DraftObject {
  type: OrUnknown<ObjectType>;
  id: string;
  name?: string | null;
  /** Where the object is shown. Null when it has no page. */
  path?: string | null;
}

export interface DraftOutcome {
  code: OrUnknown<OutcomeCode>;
  message: string;
  /** Null when nothing was sent to the gateway. */
  gateway_result: OrUnknown<GatewayResult> | null;
  applied_count: number;
  failed_count: number;
  unconfirmed_count: number;
  skipped_count: number;
  not_found_count: number;
  results: AlertOutcome[];
  finished_at: string | null;
  /** Object kinds only. A gateway older than objects leaves it out. */
  object?: DraftObject | null;
}

export interface DraftView {
  id: string;
  conversation_id: string;
  /** An open set: the payload's shape depends on it. */
  kind: string;
  state: DraftState;
  permitted: boolean;
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
  payload: Record<string, unknown>;
  outcome: DraftOutcome | null;
}

export interface TimelineMessage {
  type: "message";
  id: string;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  created_at: string;
}

export interface TimelineDraft {
  type: "draft";
  draft: DraftView;
}

/**
 * A page the assistant offers to open: the user clicks it, nothing navigates
 * on its own. Shown only when `lib/navigation.ts` reads its path back.
 */
export interface AssistantLink {
  /** The id of the tool row that made it, streamed or stored. */
  id: string;
  page: OrUnknown<LinkPage>;
  /** What the page shows, as the path names it (a preset name lowercased). */
  param: string | null;
  /** Built by the gateway from the page and its parameter. */
  path: string;
  /** The link's whole text. */
  label: string;
}

export interface TimelineLink extends AssistantLink {
  type: "link";
  created_at: string;
}

/** The items this build shows; others are left out when they are read. */
export type TimelineItem = TimelineMessage | TimelineDraft | TimelineLink;

export const TIMELINE_ITEM_TYPES: readonly TimelineItem["type"][] = [
  "message",
  "draft",
  "link",
];

export interface ConversationView {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  turn_in_progress: boolean;
  has_more: boolean;
  items: TimelineItem[];
}

export interface ChatContext {
  page: string;
  selected_fingerprints: string[];
  /** The true size of the selection; the list carries the first 200. */
  selected_count: number;
  /**
   * The alerts search box's CEL (`?cel=`), on an `/alerts/` page only. Left
   * out when there is none, or when it can't be sent whole.
   */
  search_cel?: string;
  /** The browser's IANA time zone; the gateway uses UTC for one it doesn't know. */
  timezone?: string;
}

export interface ChatRequest {
  conversation_id: string | null;
  message: string;
  context: ChatContext;
}

export interface ToolStatus {
  tool_call_id: string;
  tool: string;
  phase: ToolPhase;
  label: string;
  /** Only on `finished`. */
  outcome?: OrUnknown<ToolOutcome>;
}

export interface StreamError {
  code: OrUnknown<StreamErrorCode>;
  message: string;
  retryable: boolean;
}

/** One event of the chat stream: its name and its parsed data. */
export type StreamEvent =
  | {
      event: "conversation";
      data: {
        conversation_id: string;
        user_message_id: string;
        turn_id: string;
      };
    }
  | { event: "text_delta"; data: { message_id: string; delta: string } }
  | { event: "tool_status"; data: ToolStatus }
  | { event: "draft"; data: { draft: DraftView } }
  | { event: "error"; data: StreamError }
  | {
      event: "done";
      data: {
        message_id: string | null;
        finish_reason: OrUnknown<FinishReason>;
      };
    }
  | { event: "link"; data: AssistantLink };

/** The SQL the browser derived from a filter, as the gateway takes it. */
export interface SqlQueryInput {
  sql: string;
  params: Record<string, string | number | boolean>;
}

/**
 * The body of a Confirm, for a kind that needs what only the browser can
 * compute. Other kinds are confirmed without a body.
 */
export interface ConfirmDraftBody {
  derived: { cel_roundtrip: string; sql_query: SqlQueryInput };
}

export interface DiscardDraftBody {
  reason: DiscardReason;
}

/** The body of every error of the assistant routes. */
export interface AssistantErrorBody {
  errors: { field: string | null; code: string; message: string }[];
  detail: string;
  /** On a 409 about a draft, except `draft_unsupported`. */
  draft?: DraftView;
}

// Request limits. The gateway answers 400 beyond them.
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_PAGE_CHARS = 200;
export const MAX_SELECTED_FINGERPRINTS = 200;
export const MAX_FINGERPRINT_CHARS = 512;
export const MAX_SEARCH_CEL_CHARS = 2000;
