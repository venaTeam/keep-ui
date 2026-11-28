"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PencilSquareIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { usePathname } from "next/navigation";
import {
  buildChatContext,
  useAssistantChat,
  useAssistantContextStore,
  useAssistantPanelStore,
} from "@/entities/assistant";
import { useDraftOutcomeRefresh } from "@/features/assistant-draft-card";
import { Composer } from "./Composer";
import { ContextChips } from "./ContextChips";
import { ErrorNotice } from "./ErrorNotice";
import { MessageList } from "./MessageList";

const HEADER_BUTTON_CLASSES =
  "rounded p-1 text-gray-500 hover:bg-stone-200/50 hover:text-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300";

const LOAD_ERROR = {
  code: null,
  message: "The conversation could not be loaded.",
  retryAfterSeconds: null,
};

/**
 * Moves the focus into the panel when the user opens it, and back to where it
 * was when closing the panel takes it away.
 */
function usePanelFocus(
  isOpen: boolean,
  inputRef: { current: HTMLTextAreaElement | null }
) {
  useEffect(() => {
    if (!isOpen || !useAssistantPanelStore.getState().isOpenedByUser) {
      return;
    }
    const opener = document.activeElement;
    inputRef.current?.focus();
    return () => {
      const isFocusLost =
        !document.activeElement || document.activeElement === document.body;
      if (isFocusLost && opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  }, [isOpen, inputRef]);
}

/**
 * The assistant: docked beside the page on wide screens, over it on others.
 * Renders nothing while it is closed, but keeps its state.
 */
export function AssistantPanel() {
  const isOpen = useAssistantPanelStore((state) => state.isOpen);
  const close = useAssistantPanelStore((state) => state.close);
  const selection = useAssistantContextStore((state) => state.selection);
  const isSelectionIncluded = useAssistantContextStore(
    (state) => state.selectionIncluded
  );
  const excludeSelection = useAssistantContextStore(
    (state) => state.excludeSelection
  );
  const includeSelection = useAssistantContextStore(
    (state) => state.includeSelection
  );
  const composerPrefill = useAssistantContextStore(
    (state) => state.composerPrefill
  );
  const clearComposerPrefill = useAssistantContextStore(
    (state) => state.clearComposerPrefill
  );
  const page = usePathname() ?? "";
  const chat = useAssistantChat();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  usePanelFocus(isOpen, inputRef);

  // A card's follow-up: its alerts are the selection already
  useEffect(() => {
    // Read when taken, so that a second run of the effect finds nothing
    const prefill = useAssistantContextStore.getState().composerPrefill;
    if (prefill === null || !isOpen) {
      return;
    }
    clearComposerPrefill();
    // In front of what was written in the meantime
    setText((current) => (current ? `${prefill}\n${current}` : prefill));
    inputRef.current?.focus();
  }, [composerPrefill, clearComposerPrefill, isOpen]);

  const drafts = useMemo(
    () =>
      chat.entries.flatMap((entry) =>
        entry.type === "draft" ? [entry.draft] : []
      ),
    [chat.entries]
  );
  useDraftOutcomeRefresh(drafts);

  const send = async () => {
    const message = text;
    const fingerprints = isSelectionIncluded
      ? selection.map((alert) => alert.fingerprint)
      : [];
    setText("");
    // Removed for this message only
    includeSelection();
    const isAccepted = await chat.send(
      message,
      // The address as it is now: the panel doesn't watch the search params
      buildChatContext(page, fingerprints, window.location.search)
    );
    if (isAccepted) {
      return;
    }
    // Back to the composer, in front of what was written in the meantime
    setText((current) => (current ? `${message}\n${current}` : message));
    if (!isSelectionIncluded) {
      excludeSelection();
    }
  };

  const startNew = () => {
    chat.startNew();
    inputRef.current?.focus();
  };

  const isBusy = chat.isStreaming || chat.isAnswering;
  const error =
    chat.error ?? (chat.loadError && !isBusy ? LOAD_ERROR : undefined);

  if (!isOpen) {
    return null;
  }
  return (
    <section
      aria-label="Assistant"
      data-cy="assistant-panel"
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-gray-300 bg-white shadow-xl sm:w-[400px] xl:static xl:z-auto xl:col-start-4 xl:row-start-1 xl:h-screen xl:w-[400px] xl:shadow-none 2xl:w-[440px]"
    >
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-gray-900">Assistant</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="New conversation"
            aria-label="New conversation"
            data-cy="assistant-new-conversation"
            className={HEADER_BUTTON_CLASSES}
            onClick={startNew}
          >
            <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Close"
            aria-label="Close the assistant"
            data-cy="assistant-panel-close"
            className={HEADER_BUTTON_CLASSES}
            onClick={close}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <MessageList
        entries={chat.entries}
        hasMore={chat.hasMore}
        isLoading={chat.isLoading}
        isStreaming={chat.isStreaming}
        isAnswering={chat.isAnswering}
        timedOutDraftIds={chat.timedOutDraftIds}
        onChange={chat.replaceDraft}
        onUncertain={chat.refetch}
        onCheckAgain={chat.checkDraftAgain}
      />

      <footer className="flex flex-col gap-2 border-t border-gray-200 p-3">
        {error && (
          <ErrorNotice
            error={error}
            onRetry={error === LOAD_ERROR ? () => chat.refetch() : undefined}
          />
        )}
        <ContextChips
          page={page}
          selectedCount={isSelectionIncluded ? selection.length : 0}
          onRemoveSelection={excludeSelection}
        />
        <Composer
          inputRef={inputRef}
          value={text}
          onChange={setText}
          onSend={send}
          isBusy={isBusy}
        />
      </footer>
    </section>
  );
}
