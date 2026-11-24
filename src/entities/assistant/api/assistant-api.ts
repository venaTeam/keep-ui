import type { ApiClient } from "@/shared/api";
import { ConversationView, DraftView } from "../model/types";

/** The conversation's path, which is also its SWR key. */
export function getConversationUrl(conversationId: string): string {
  return `/assistant/conversations/${encodeURIComponent(conversationId)}`;
}

function getDraftUrl(draftId: string, action: "confirm" | "discard"): string {
  return `/assistant/drafts/${encodeURIComponent(draftId)}/${action}`;
}

// `ApiClient` returns text, or null, for a 200 that is not JSON
function assertShape<T>(body: unknown, key: keyof T & string): T {
  if (typeof body !== "object" || body === null || !(key in body)) {
    throw new Error("Unexpected response from the assistant");
  }
  return body as T;
}

export async function getConversation(
  api: ApiClient,
  conversationId: string
): Promise<ConversationView> {
  return assertShape<ConversationView>(
    await api.get(getConversationUrl(conversationId), { cache: "no-store" }),
    "items"
  );
}

export async function confirmDraft(
  api: ApiClient,
  draftId: string
): Promise<DraftView> {
  return assertShape<DraftView>(
    await api.post(getDraftUrl(draftId, "confirm")),
    "state"
  );
}

export async function discardDraft(
  api: ApiClient,
  draftId: string
): Promise<DraftView> {
  return assertShape<DraftView>(
    await api.post(getDraftUrl(draftId, "discard")),
    "state"
  );
}
