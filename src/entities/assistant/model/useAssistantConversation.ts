import { useCallback, useMemo, useRef } from "react";
import useSWR from "swr";
import { useApi } from "@/shared/lib/hooks/useApi";
import { getConversation, getConversationUrl } from "../api/assistant-api";
import { getAssistantError } from "../api/assistant-error";
import { ConversationView, DraftView, TimelineItem } from "./types";
import { useBudgetedPolling } from "./useBudgetedPolling";

/** Longer than the 120 s after which the server frees a stuck turn. */
export const TURN_POLL_BUDGET_MS = 135_000;
export const DRAFT_POLL_BUDGET_MS = 90_000;

const TURN_KEY = "turn";
const NO_DRAFTS: DraftView[] = [];

interface UseAssistantConversationOptions {
  /** The turn in progress is the one this page streams. */
  isStreaming?: boolean;
  /** Drafts of the live turn, which the stored view may not have yet. */
  liveDrafts?: DraftView[];
  /** The conversation does not exist, or not for this user. */
  onMissing?: (conversationId: string) => void;
}

interface RefetchOptions {
  /** The stream said that the turn ended, whatever the view still says. */
  isTurnOver?: boolean;
}

function replaceInItems(
  items: TimelineItem[],
  draft: DraftView
): TimelineItem[] {
  return items.map((item) =>
    item.type === "draft" && item.draft.id === draft.id
      ? { type: "draft", draft }
      : item
  );
}

/**
 * The stored timeline of a conversation. Polls while the server still works on
 * it: on a turn this page does not stream, or on applying a draft.
 */
export function useAssistantConversation(
  conversationId: string | null,
  {
    isStreaming = false,
    liveDrafts = NO_DRAFTS,
    onMissing,
  }: UseAssistantConversationOptions = {}
) {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const onMissingRef = useRef(onMissing);
  onMissingRef.current = onMissing;
  const currentId = useRef(conversationId);
  currentId.current = conversationId;
  // Counts local changes, which an answer requested before them cannot know
  const changes = useRef(0);
  // Answers can overtake each other: the last one asked for wins
  const lastAsked = useRef(0);
  const lastApplied = useRef(0);

  const handleError = useCallback((error: unknown, id: string) => {
    if (getAssistantError(error)?.status === 404) {
      onMissingRef.current?.(id);
    }
  }, []);

  const {
    data: view,
    error,
    mutate,
    isLoading,
  } = useSWR<ConversationView>(
    api.isReady() && conversationId ? getConversationUrl(conversationId) : null,
    () => getConversation(apiRef.current, conversationId as string),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onError: (swrError) =>
        conversationId && handleError(swrError, conversationId),
    }
  );

  const viewRef = useRef(view);
  viewRef.current = view;

  /** Reads the conversation again. The view is null when it was not updated. */
  const refetch = useCallback(
    async ({ isTurnOver = false }: RefetchOptions = {}): Promise<{
      view: ConversationView | null;
      status: number | null;
    }> => {
      const id = currentId.current;
      if (!id) {
        return { view: null, status: null };
      }
      if (isTurnOver && viewRef.current?.turn_in_progress) {
        mutate(
          (current) => current && { ...current, turn_in_progress: false },
          {
            revalidate: false,
          }
        );
      }
      for (;;) {
        const changesBefore = changes.current;
        const asked = ++lastAsked.current;
        try {
          const answer = await getConversation(apiRef.current, id);
          if (currentId.current !== id || asked < lastApplied.current) {
            return { view: null, status: null };
          }
          if (changes.current !== changesBefore) {
            continue;
          }
          lastApplied.current = asked;
          const next = isTurnOver
            ? { ...answer, turn_in_progress: false }
            : answer;
          await mutate(next, { revalidate: false });
          return { view: next, status: 200 };
        } catch (refetchError) {
          handleError(refetchError, id);
          return {
            view: null,
            status: getAssistantError(refetchError)?.status ?? null,
          };
        }
      }
    },
    [mutate, handleError]
  );

  /** Shows the draft as the server just returned it. */
  const replaceDraft = useCallback(
    (draft: DraftView) => {
      changes.current += 1;
      if (viewRef.current) {
        mutate(
          (current) =>
            current && {
              ...current,
              items: replaceInItems(current.items, draft),
            },
          { revalidate: false }
        );
      }
    },
    [mutate]
  );

  const applyingIds = useMemo(() => {
    const drafts = new Map(liveDrafts.map((draft) => [draft.id, draft]));
    view?.items.forEach((item) => {
      if (item.type === "draft") {
        drafts.set(item.draft.id, item.draft);
      }
    });
    return Array.from(drafts.values())
      .filter((draft) => draft.state === "applying")
      .map((draft) => draft.id);
  }, [view, liveDrafts]);

  const isTurnAwaited = !!view?.turn_in_progress && !isStreaming;
  const budgets = useMemo(
    () => ({
      ...(isTurnAwaited && { [TURN_KEY]: TURN_POLL_BUDGET_MS }),
      ...Object.fromEntries(
        applyingIds.map((id) => [id, DRAFT_POLL_BUDGET_MS])
      ),
    }),
    [isTurnAwaited, applyingIds]
  );
  const { timedOut, restart } = useBudgetedPolling(budgets, async () => {
    const { status } = await refetch();
    // Anything else may pass: a 502 while the gateway is busy applying
    return status !== 401 && status !== 403;
  });

  const checkDraftAgain = useCallback(
    (draftId: string) => {
      restart(draftId);
      refetch();
    },
    [restart, refetch]
  );

  return {
    view,
    isLoading,
    error,
    refetch,
    replaceDraft,
    /** The server is on a turn this page does not stream. */
    isAnswering: isTurnAwaited && !timedOut.has(TURN_KEY),
    /** Drafts that are still applying after the time this page waited. */
    timedOutDraftIds: timedOut,
    checkDraftAgain,
  };
}
