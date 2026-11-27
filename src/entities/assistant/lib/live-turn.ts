import {
  DraftView,
  StreamError,
  StreamEvent,
  TimelineItem,
  TimelineMessage,
  ToolStatus,
} from "../model/types";

type LiveItem =
  | { type: "text"; messageId: string; content: string }
  | { type: "tool"; tool: ToolStatus }
  | { type: "draft"; draft: DraftView };

/** The turn being streamed, until the stored conversation has all of it. */
export interface LiveTurn {
  userMessage: string;
  /** Null until the server stored the message. */
  userMessageId: string | null;
  items: LiveItem[];
  error: StreamError | null;
  isInterrupted: boolean;
}

/** One row of the conversation, stored or live. */
export type TimelineEntry =
  | {
      key: string;
      type: "message";
      role: TimelineMessage["role"];
      content: string;
      status: TimelineMessage["status"];
    }
  | { key: string; type: "draft"; draft: DraftView }
  | { key: string; type: "tool"; tool: ToolStatus };

export function startTurn(userMessage: string): LiveTurn {
  return {
    userMessage,
    userMessageId: null,
    items: [],
    error: null,
    isInterrupted: false,
  };
}

function upsert(
  items: LiveItem[],
  isMatch: (item: LiveItem) => boolean,
  next: (previous: LiveItem | undefined) => LiveItem
): LiveItem[] {
  const index = items.findIndex(isMatch);
  return index === -1
    ? [...items, next(undefined)]
    : items.map((item, at) => (at === index ? next(item) : item));
}

export function applyStreamEvent(turn: LiveTurn, event: StreamEvent): LiveTurn {
  switch (event.event) {
    case "conversation":
      return { ...turn, userMessageId: event.data.user_message_id };
    case "text_delta": {
      const { message_id: messageId, delta } = event.data;
      return {
        ...turn,
        items: upsert(
          turn.items,
          (item) => item.type === "text" && item.messageId === messageId,
          (item) => ({
            type: "text",
            messageId,
            content: (item?.type === "text" ? item.content : "") + delta,
          })
        ),
      };
    }
    case "tool_status":
      return {
        ...turn,
        items: upsert(
          turn.items,
          (item) =>
            item.type === "tool" &&
            item.tool.tool_call_id === event.data.tool_call_id,
          () => ({ type: "tool", tool: event.data })
        ),
      };
    case "draft":
      return {
        ...turn,
        items: upsert(
          turn.items,
          (item) =>
            item.type === "draft" && item.draft.id === event.data.draft.id,
          () => ({ type: "draft", draft: event.data.draft })
        ),
      };
    case "error":
      return { ...turn, error: event.data };
    case "done":
      return turn;
    default:
      // An event of a newer gateway
      return turn;
  }
}

/** Replaces the draft if the turn has it; a turn without it stays the same. */
export function replaceLiveDraft(turn: LiveTurn, draft: DraftView): LiveTurn {
  const isSameDraft = (item: LiveItem) =>
    item.type === "draft" && item.draft.id === draft.id;
  if (!turn.items.some(isSameDraft)) {
    return turn;
  }
  return {
    ...turn,
    items: turn.items.map((item) =>
      isSameDraft(item) ? { type: "draft", draft } : item
    ),
  };
}

export function getLiveDrafts(turn: LiveTurn | null): DraftView[] {
  return (turn?.items ?? []).flatMap((item) =>
    item.type === "draft" ? [item.draft] : []
  );
}

/** Whether the stored items include the message that started the turn. */
export function hasStoredTurn(items: TimelineItem[], turn: LiveTurn): boolean {
  return items.some(
    (item) => item.type === "message" && item.id === turn.userMessageId
  );
}

function toEntry(item: TimelineItem): TimelineEntry[] {
  switch (item.type) {
    case "draft":
      return [
        { key: `draft-${item.draft.id}`, type: "draft", draft: item.draft },
      ];
    case "message":
      return [
        {
          key: item.id,
          type: "message",
          role: item.role,
          content: item.content,
          status: item.status,
        },
      ];
    default:
      // An item of a newer gateway
      return [];
  }
}

/**
 * The stored conversation followed by what only the live turn has. An item in
 * both is taken from the server. Items this build does not know are left out.
 */
export function mergeTimeline(
  stored: TimelineItem[],
  turn: LiveTurn | null
): TimelineEntry[] {
  const entries = stored.flatMap(toEntry);
  if (!turn) {
    return entries;
  }

  const storedKeys = new Set(entries.map((entry) => entry.key));
  const live: TimelineEntry[] = [
    {
      key: turn.userMessageId ?? "live-user-message",
      type: "message",
      role: "user",
      content: turn.userMessage,
      status: "complete",
    },
    ...turn.items.map((item, index): TimelineEntry => {
      switch (item.type) {
        case "text":
          return {
            key: item.messageId,
            type: "message",
            role: "assistant",
            content: item.content,
            // Only the text that was still arriving
            status:
              turn.isInterrupted && index === turn.items.length - 1
                ? "interrupted"
                : "complete",
          };
        case "tool":
          return {
            key: `tool-${item.tool.tool_call_id}`,
            type: "tool",
            tool: item.tool,
          };
        case "draft":
          return {
            key: `draft-${item.draft.id}`,
            type: "draft",
            draft: item.draft,
          };
      }
    }),
  ];
  return [...entries, ...live.filter((entry) => !storedKeys.has(entry.key))];
}
