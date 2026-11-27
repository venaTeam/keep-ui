import type { ApiClient } from "@/shared/api";
import {
  ConfirmDraftBody,
  ConversationView,
  DiscardDraftBody,
  DraftView,
  TIMELINE_ITEM_TYPES,
  TimelineItem,
} from "../model/types";

/** The conversation's path, which is also its SWR key. */
export function getConversationUrl(conversationId: string): string {
  return `/assistant/conversations/${encodeURIComponent(conversationId)}`;
}

function getDraftUrl(draftId: string, action: "confirm" | "discard"): string {
  return `/assistant/drafts/${encodeURIComponent(draftId)}/${action}`;
}

const UNEXPECTED = "Unexpected response from the assistant";

// `ApiClient` returns text, or null, for a 200 that is not JSON
function assertShape<T>(body: unknown, key: keyof T & string): T {
  if (typeof body !== "object" || body === null || !(key in body)) {
    throw new Error(UNEXPECTED);
  }
  return body as T;
}

const isKnownItem = (item: unknown): item is TimelineItem =>
  typeof item === "object" &&
  item !== null &&
  (TIMELINE_ITEM_TYPES as readonly unknown[]).includes(
    (item as { type?: unknown }).type
  );

/** The conversation, without the items of a newer gateway. */
export async function getConversation(
  api: ApiClient,
  conversationId: string
): Promise<ConversationView> {
  const view = assertShape<ConversationView>(
    await api.get(getConversationUrl(conversationId), { cache: "no-store" }),
    "items"
  );
  if (!Array.isArray(view.items)) {
    throw new Error(UNEXPECTED);
  }
  return { ...view, items: view.items.filter(isKnownItem) };
}

// A kind that takes no body is sent none, as before bodies existed
const post = (api: ApiClient, url: string, body: object | undefined) =>
  body ? api.post(url, body) : api.post(url);

export async function confirmDraft(
  api: ApiClient,
  draftId: string,
  body?: ConfirmDraftBody
): Promise<DraftView> {
  return assertShape<DraftView>(
    await post(api, getDraftUrl(draftId, "confirm"), body),
    "state"
  );
}

export async function discardDraft(
  api: ApiClient,
  draftId: string,
  body?: DiscardDraftBody
): Promise<DraftView> {
  return assertShape<DraftView>(
    await post(api, getDraftUrl(draftId, "discard"), body),
    "state"
  );
}
