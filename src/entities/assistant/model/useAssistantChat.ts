import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "@/shared/lib/hooks/useApi";
import { useHydratedSession } from "@/shared/lib/hooks/useHydratedSession";
import {
  getAssistantError,
  isAssistantUnavailable,
  isConversationMissing,
} from "../api/assistant-error";
import { streamChat } from "../api/stream-chat";
import {
  applyStreamEvent,
  getLiveDrafts,
  hasStoredTurn,
  LiveTurn,
  mergeTimeline,
  replaceLiveDraft,
  startTurn,
} from "../lib/live-turn";
import { useAssistantPanelStore } from "./assistant-panel-store";
import {
  ChatContext,
  ConversationView,
  DraftView,
  StreamEvent,
  TimelineItem,
} from "./types";
import { useAssistantConversation } from "./useAssistantConversation";

/** How long text deltas are collected before the next render. */
export const DELTA_FLUSH_MS = 50;

// Sessions without a tenant, such as a guest's
const NO_TENANT = "default";
const NO_ITEMS: TimelineItem[] = [];

export interface ChatError {
  code: string | null;
  message: string;
  retryAfterSeconds: number | null;
}

const UNREACHABLE: ChatError = {
  code: null,
  message: "The assistant could not be reached. Try again.",
  retryAfterSeconds: null,
};
const UNAVAILABLE: ChatError = {
  code: null,
  message: "Keep Assistant is not available.",
  retryAfterSeconds: null,
};
const INTERRUPTED: ChatError = {
  code: null,
  message: "The connection was interrupted before the answer was complete.",
  retryAfterSeconds: null,
};

function getUserMessageIds(view: ConversationView | undefined): Set<string> {
  return new Set(
    (view?.items ?? []).flatMap((item) =>
      item.type === "message" && item.role === "user" ? [item.id] : []
    )
  );
}

/** Whether the view has a new user message with this text. */
function hasNewMessage(
  view: ConversationView | null,
  message: string,
  knownIds: Set<string>
): boolean {
  return !!view?.items.some(
    (item) =>
      item.type === "message" &&
      item.role === "user" &&
      item.content === message &&
      !knownIds.has(item.id)
  );
}

/**
 * The current conversation of the tenant: its timeline, with the turn being
 * streamed on top, and sending the next message.
 */
export function useAssistantChat() {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;

  const { data: session } = useHydratedSession();
  const tenantId = session?.tenantId ?? NO_TENANT;
  const conversationId = useAssistantPanelStore(
    (state) => state.conversationIdByTenant[tenantId] ?? null
  );
  const setConversationId = useAssistantPanelStore(
    (state) => state.setConversationId
  );
  const clearConversationId = useAssistantPanelStore(
    (state) => state.clearConversationId
  );

  const [turn, setTurn] = useState<LiveTurn | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const liveDrafts = useMemo(() => getLiveDrafts(turn), [turn]);
  const onMissing = useCallback(
    (id: string) => clearConversationId(tenantId, id),
    [clearConversationId, tenantId]
  );
  const {
    view,
    isLoading,
    error: loadError,
    refetch,
    replaceDraft: replaceStoredDraft,
    isAnswering,
    timedOutDraftIds,
    checkDraftAgain,
  } = useAssistantConversation(conversationId, {
    isStreaming,
    liveDrafts,
    onMissing,
  });
  const viewRef = useRef(view);
  viewRef.current = view;

  // The live turn is needed only until the stored conversation has all of it
  const isTurnStored =
    !isStreaming &&
    !!turn &&
    !!view &&
    !view.turn_in_progress &&
    hasStoredTurn(view.items, turn);
  useEffect(() => {
    if (isTurnStored) {
      setTurn(null);
    }
  }, [isTurnStored]);

  useEffect(() => () => abortController.current?.abort(), []);

  const send = useCallback(
    /**
     * @returns whether the server has the message, so that a refused one can
     *   go back to the composer.
     */
    async (message: string, context: ChatContext): Promise<boolean> => {
      const text = message.replace(/\0/g, "").trim();
      if (!text || abortController.current) {
        return false;
      }
      const controller = new AbortController();
      abortController.current = controller;
      const knownIds = getUserMessageIds(viewRef.current);

      let pending: StreamEvent[] = [];
      let flushTimer: ReturnType<typeof setTimeout> | undefined;
      let streamError: ChatError | null = null;
      let hasConversation = false;

      const flush = () => {
        clearTimeout(flushTimer);
        flushTimer = undefined;
        const events = pending;
        pending = [];
        if (events.length > 0 && !controller.signal.aborted) {
          setTurn(
            (current) => current && events.reduce(applyStreamEvent, current)
          );
        }
      };
      const onEvent = (event: StreamEvent) => {
        if (controller.signal.aborted) {
          return;
        }
        pending.push(event);
        if (event.event === "text_delta") {
          flushTimer ??= setTimeout(flush, DELTA_FLUSH_MS);
          return;
        }
        if (event.event === "conversation") {
          hasConversation = true;
          setConversationId(tenantId, event.data.conversation_id);
        }
        if (event.event === "error") {
          streamError = {
            code: event.data.code,
            message: event.data.message,
            retryAfterSeconds: null,
          };
        }
        flush();
      };
      const stream = (id: string | null) =>
        streamChat({
          api: apiRef.current,
          request: { conversation_id: id, message: text, context },
          signal: controller.signal,
          onEvent,
        });

      /** Runs once the stream is over, however it ended. */
      const finish = () => {
        flush();
        if (abortController.current === controller) {
          abortController.current = null;
          setIsStreaming(false);
        }
      };

      setError(null);
      setTurn(startTurn(text));
      setIsStreaming(true);
      try {
        try {
          await stream(conversationId);
        } catch (chatError) {
          const isMissing =
            conversationId !== null && isConversationMissing(chatError);
          if (!isMissing || controller.signal.aborted) {
            throw chatError;
          }
          clearConversationId(tenantId, conversationId);
          await stream(null);
        }
        if (controller.signal.aborted) {
          finish();
          return true;
        }
        const refetching = refetch({ isTurnOver: true });
        finish();
        setError(streamError);
        await refetching;
        return true;
      } catch (chatError) {
        finish();
        if (controller.signal.aborted) {
          return hasConversation;
        }

        const refusal = getAssistantError(chatError);
        if (hasConversation) {
          // Broken in the middle: the server has the message, and whatever it
          // stored of the answer
          setTurn((current) => current && { ...current, isInterrupted: true });
          setError(streamError ?? INTERRUPTED);
          await refetch();
          return true;
        }

        setTurn(null);
        if (refusal && isAssistantUnavailable(refusal)) {
          setError(UNAVAILABLE);
          return false;
        }
        setError(
          refusal
            ? {
                code: refusal.code,
                message: refusal.message,
                retryAfterSeconds: refusal.retryAfterSeconds,
              }
            : UNREACHABLE
        );
        if (refusal?.status === 409) {
          const { view: refetched } = await refetch();
          if (refetched?.turn_in_progress) {
            // Shown as the answer in progress, until it is over
            setError(null);
          }
          return false;
        }
        if (refusal?.status && refusal.status < 500) {
          return false;
        }
        const { view: refetched } = await refetch();
        const isStored = hasNewMessage(refetched, text, knownIds);
        if (isStored) {
          setError(INTERRUPTED);
        }
        return isStored;
      }
    },
    [conversationId, tenantId, setConversationId, clearConversationId, refetch]
  );

  /** Leaves the conversation, and the turn in progress if there is one. */
  const startNew = useCallback(() => {
    abortController.current?.abort();
    abortController.current = null;
    setIsStreaming(false);
    setTurn(null);
    setError(null);
    clearConversationId(tenantId);
  }, [clearConversationId, tenantId]);

  const replaceDraft = useCallback(
    (draft: DraftView) => {
      replaceStoredDraft(draft);
      setTurn((current) => current && replaceLiveDraft(current, draft));
    },
    [replaceStoredDraft]
  );

  const entries = useMemo(
    () => mergeTimeline(view?.items ?? NO_ITEMS, turn),
    [view, turn]
  );

  return {
    entries,
    hasMore: view?.has_more ?? false,
    isLoading,
    loadError,
    /** This page streams the answer. */
    isStreaming,
    /** The server is on an answer this page does not stream. */
    isAnswering,
    error,
    send,
    startNew,
    refetch,
    replaceDraft,
    timedOutDraftIds,
    checkDraftAgain,
  };
}
