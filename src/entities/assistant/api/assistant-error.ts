import { KeepApiError } from "@/shared/api";
import { AssistantErrorBody, DraftView } from "../model/types";

/** A refusal of the chat endpoint, with its `Retry-After` when it has one. */
export class AssistantChatError extends KeepApiError {
  constructor(
    message: string,
    url: string,
    responseJson: unknown,
    statusCode: number,
    readonly retryAfterSeconds: number | null
  ) {
    super(message, url, "Please try again.", responseJson, statusCode);
    this.name = "AssistantChatError";
  }
}

export interface AssistantError {
  code: string | null;
  message: string;
  status: number | null;
  retryAfterSeconds: number | null;
  /** The current draft, on a 409 about a draft. */
  draft: DraftView | null;
}

function parseRetryAfter(value: string | null): number | null {
  return value !== null && /^\d+$/.test(value.trim()) ? Number(value) : null;
}

function getBody(error: KeepApiError): Partial<AssistantErrorBody> {
  const body: unknown = error.responseJson;
  return typeof body === "object" && body !== null ? body : {};
}

/**
 * The error behind a failed chat response. A body that is not JSON (Next's own
 * 500, a proxy's 502) says nothing about what the server did, so it becomes a
 * plain `Error`, the same as in `ApiClient`.
 */
export async function toChatError(
  response: Response,
  url: string
): Promise<Error> {
  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const body: unknown = isJson ? await response.json().catch(() => null) : null;
  if (typeof body !== "object" || body === null) {
    return new Error("An error occurred while fetching the data");
  }
  const { errors, detail } = body as Partial<AssistantErrorBody>;
  return new AssistantChatError(
    errors?.[0]?.message ?? `${detail ?? "Something went wrong."}`,
    url,
    body,
    response.status,
    parseRetryAfter(response.headers.get("retry-after"))
  );
}

/**
 * What the gateway said, for an error of either client. Null means the
 * outcome is unknown (no JSON answer): refetch to find out.
 */
export function getAssistantError(error: unknown): AssistantError | null {
  if (!(error instanceof KeepApiError)) {
    return null;
  }
  const { errors, draft } = getBody(error);
  return {
    code: errors?.[0]?.code ?? null,
    message: errors?.[0]?.message ?? error.message,
    status: error.statusCode ?? null,
    retryAfterSeconds:
      error instanceof AssistantChatError ? error.retryAfterSeconds : null,
    draft: draft?.id ? draft : null,
  };
}

/**
 * Whether the conversation itself is gone. The status alone cannot tell: a
 * gateway whose assistant is switched off also answers 404.
 */
export function isConversationMissing(error: unknown): boolean {
  return getAssistantError(error)?.code === "conversation_not_found";
}

/** Whether the gateway has no assistant routes. */
export function isAssistantUnavailable(error: AssistantError): boolean {
  return error.status === 404 && error.code === null;
}
