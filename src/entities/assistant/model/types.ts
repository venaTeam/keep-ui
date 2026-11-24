/**
 * The keep-assistant API contract. Mirrors keep-assistant `src/models/api/*`,
 * pinned on both sides by the vendored `__fixtures__/assistant_stream.json`.
 */

export const STREAM_EVENT_NAMES = [
  "conversation",
  "text_delta",
  "tool_status",
  "draft",
  "error",
  "done",
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

export const MESSAGE_STATUSES = ["complete", "interrupted", "error"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

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
  result: AlertResult;
  status_after: string | null;
}

export interface DraftOutcome {
  code: OutcomeCode;
  message: string;
  /** Null when nothing was sent to the gateway. */
  gateway_result: GatewayResult | null;
  applied_count: number;
  failed_count: number;
  unconfirmed_count: number;
  skipped_count: number;
  not_found_count: number;
  results: AlertOutcome[];
  finished_at: string | null;
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

export type TimelineItem = TimelineMessage | TimelineDraft;

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
  outcome?: ToolOutcome;
}

export interface StreamError {
  code: StreamErrorCode;
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
      data: { message_id: string | null; finish_reason: FinishReason };
    };

/** The body of every keep-assistant error, and of the middleware's 503. */
export interface AssistantErrorBody {
  errors: { field: string | null; code: string; message: string }[];
  detail: string;
  /** On a 409 about a draft. */
  draft?: DraftView;
}

// Request limits. keep-assistant answers 400 beyond them.
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_PAGE_CHARS = 200;
export const MAX_SELECTED_FINGERPRINTS = 200;
export const MAX_FINGERPRINT_CHARS = 512;
