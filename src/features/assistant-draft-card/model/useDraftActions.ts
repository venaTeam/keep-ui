import { useCallback, useRef, useState } from "react";
import {
  AssistantError,
  confirmDraft,
  discardDraft,
  DraftView,
  getAssistantError,
} from "@/entities/assistant";
import type { ApiClient } from "@/shared/api";
import { useApi } from "@/shared/lib/hooks/useApi";
import { recordAction, recordError } from "@/utils/metrics";

type DraftAction = "confirm" | "discard";

const UNREACHABLE = "Couldn't reach Keep, try again.";

// Sent before anything is written, so the draft is still what it was
const NOTHING_HAPPENED = [400, 401, 403, 429, 502, 503];

function isUncertain(error: AssistantError | null): boolean {
  return !error?.status || !NOTHING_HAPPENED.includes(error.status);
}

function getMessage(error: AssistantError | null): string {
  return !error?.status || error.status >= 500 ? UNREACHABLE : error.message;
}

interface DraftActionsOptions {
  /** Called with the draft as the server has it now. */
  onChange: (draft: DraftView) => void;
  /** Reads the conversation again, when the answer says nothing certain. */
  onUncertain: () => Promise<unknown>;
}

/** Confirm and Discard of one draft. */
export function useDraftActions(
  draftId: string | undefined,
  { onChange, onUncertain }: DraftActionsOptions
) {
  const api = useApi();
  const inFlight = useRef(false);
  const [action, setAction] = useState<DraftAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (
      name: DraftAction,
      request: (api: ApiClient, id: string) => Promise<DraftView>
    ) => {
      // A second click must not reach the server before the next render
      if (!draftId || inFlight.current) {
        return;
      }
      inFlight.current = true;
      setAction(name);
      setError(null);
      const startedAt = performance.now();
      try {
        onChange(await request(api, draftId));
        if (name === "confirm") {
          recordAction(
            "assistant_confirm",
            (performance.now() - startedAt) / 1000
          );
        }
      } catch (requestError) {
        const assistantError = getAssistantError(requestError);
        if (name === "confirm") {
          recordError("assistant_confirm", assistantError?.status ?? undefined);
        }
        if (assistantError?.draft) {
          // 409: somebody else was first, or it expired
          onChange(assistantError.draft);
          return;
        }
        if (isUncertain(assistantError)) {
          await onUncertain();
        }
        setError(getMessage(assistantError));
      } finally {
        inFlight.current = false;
        setAction(null);
      }
    },
    [api, draftId, onChange, onUncertain]
  );

  const confirm = useCallback(() => run("confirm", confirmDraft), [run]);
  const discard = useCallback(() => run("discard", discardDraft), [run]);

  return {
    confirm,
    discard,
    isConfirming: action === "confirm",
    isDiscarding: action === "discard",
    error,
  };
}
