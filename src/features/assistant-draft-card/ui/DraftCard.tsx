import { useRef } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui";
import { DraftView } from "@/entities/assistant";
import { useConfig } from "@/utils/hooks/useConfig";
import { CardState, getDraftCardState } from "../lib/draft-card-state";
import { formatTime } from "../lib/format-time";
import { useDraftActions } from "../model/useDraftActions";
import { useNow } from "../model/useNow";
import { presentDraft } from "./draft-body-registry";
import { DraftCardOutcome } from "./DraftCardOutcome";

const TITLES: Record<CardState, string> = {
  streaming: "Preparing a draft",
  submitting: "Applying",
  "read-only": "Read-only",
  "not-permitted": "Not permitted",
  expired: "Expired",
  draft: "Draft · not saved",
  saved: "Saved",
  partial: "Partly saved",
  error: "Not saved",
  declined: "Discarded",
};

const CARD_CLASSES: Record<CardState, string> = {
  streaming: "border-dashed border-gray-300 bg-gray-50",
  submitting: "border-dashed border-orange-400 bg-orange-50",
  "read-only": "border-gray-300 bg-gray-50",
  "not-permitted": "border-gray-300 bg-gray-50",
  expired: "border-gray-300 bg-gray-50",
  draft: "border-dashed border-orange-400 bg-orange-50",
  saved: "border-green-500 bg-green-50",
  partial: "border-amber-500 bg-amber-50",
  error: "border-red-500 bg-red-50",
  declined: "border-gray-200 bg-gray-50",
};

const TITLE_CLASSES: Record<CardState, string> = {
  streaming: "text-gray-500",
  submitting: "text-orange-700",
  "read-only": "text-gray-500",
  "not-permitted": "text-gray-500",
  expired: "text-gray-500",
  draft: "text-orange-700",
  saved: "text-green-700",
  partial: "text-amber-700",
  error: "text-red-700",
  declined: "text-gray-500",
};

export interface DraftCardProps {
  /** Null while the assistant is preparing it. */
  draft: DraftView | null;
  /** The page stopped waiting for a change that is still being applied. */
  isTimedOut?: boolean;
  onChange: (draft: DraftView) => void;
  onUncertain: () => Promise<unknown>;
  onCheckAgain: (draftId: string) => void;
}

/**
 * A change the assistant drafted, which only the user's Confirm makes, and
 * afterwards the receipt of what became of it.
 */
export function DraftCard({
  draft,
  isTimedOut = false,
  onChange,
  onUncertain,
  onCheckAgain,
}: DraftCardProps) {
  const { data: config } = useConfig();
  const card = useRef<HTMLElement>(null);
  const now = useNow(draft?.expires_at);
  const { confirm, discard, isConfirming, isDiscarding, error } =
    useDraftActions(draft?.id, { onChange, onUncertain });
  const state = getDraftCardState(draft, {
    readOnly: !!config?.READ_ONLY,
    now,
    isSubmitting: isConfirming,
  });

  const className = clsx(
    "flex flex-col gap-2 rounded-lg border p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
    CARD_CLASSES[state]
  );
  const title = (
    <h3 className={clsx("text-xs font-semibold", TITLE_CLASSES[state])}>
      {TITLES[state]}
    </h3>
  );

  if (!draft) {
    return (
      <section
        aria-label={TITLES[state]}
        aria-busy="true"
        data-cy="assistant-draft-card"
        data-state={state}
        className={className}
      >
        {title}
        <div className="animate-pulse space-y-2" aria-hidden="true">
          <div className="h-3 w-2/3 rounded bg-gray-200" />
          <div className="h-3 w-full rounded bg-gray-200" />
          <div className="h-3 w-1/2 rounded bg-gray-200" />
        </div>
      </section>
    );
  }

  const { body, confirmLabel, notPermittedText } = presentDraft(draft);
  const expiresAt = state === "draft" ? formatTime(draft.expires_at) : null;
  const isSubmitting = state === "submitting";
  const canConfirm = (state === "draft" || isSubmitting) && !!confirmLabel;
  const canDiscard =
    isSubmitting || (draft.state === "pending" && state !== "expired");

  // The button that was pressed is about to be disabled, or to disappear
  const keepFocus = () => card.current?.focus();

  return (
    <section
      ref={card}
      tabIndex={-1}
      aria-label={`${TITLES[state]}${confirmLabel ? `: ${confirmLabel}` : ""}`}
      aria-busy={isSubmitting}
      data-cy="assistant-draft-card"
      data-state={state}
      className={className}
    >
      {/* All that is left of a discarded draft is its outcome */}
      {state !== "declined" && (
        <>
          <div className="flex items-baseline justify-between gap-2">
            {title}
            {expiresAt && (
              <span className="text-xs text-gray-500">Expires {expiresAt}</span>
            )}
          </div>
          {body}
        </>
      )}

      <div role="status">
        <DraftCardOutcome
          draft={draft}
          state={state}
          notPermittedText={notPermittedText}
          isTimedOut={isTimedOut}
        />
        {error && draft.state === "pending" && !isSubmitting && (
          <p className="whitespace-pre-wrap break-words text-xs text-red-700">
            {error}
          </p>
        )}
      </div>

      {(canConfirm || canDiscard) && (
        <div className="flex flex-wrap gap-2">
          {canConfirm && (
            <Button
              type="button"
              variant="primary"
              color="orange"
              size="xs"
              data-cy="assistant-draft-confirm"
              loading={isSubmitting}
              disabled={isSubmitting || isDiscarding}
              onClick={() => {
                keepFocus();
                confirm();
              }}
            >
              {confirmLabel}
            </Button>
          )}
          {canDiscard && (
            <Button
              type="button"
              variant="secondary"
              color="gray"
              size="xs"
              data-cy="assistant-draft-discard"
              loading={isDiscarding}
              disabled={isSubmitting || isDiscarding}
              onClick={() => {
                keepFocus();
                discard();
              }}
            >
              Discard
            </Button>
          )}
          {isSubmitting && isTimedOut && (
            <Button
              type="button"
              variant="secondary"
              color="orange"
              size="xs"
              data-cy="assistant-draft-check-again"
              onClick={() => {
                keepFocus();
                onCheckAgain(draft.id);
              }}
            >
              Check again
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
