import { Fragment, memo, useEffect, useRef } from "react";
import { CHANGE_ALERT_STATUS_KIND, TimelineEntry } from "@/entities/assistant";
import { DraftCard, DraftCardProps } from "@/features/assistant-draft-card";
import { MessageBubble } from "./MessageBubble";
import { Spinner } from "./Spinner";
import { ToolStatusLine } from "./ToolStatusLine";

// How close to the end still counts as reading the end
const END_MARGIN_PX = 80;
const DRAFT_TOOLS = [CHANGE_ALERT_STATUS_KIND];

const MemoDraftCard = memo(DraftCard);

function Progress({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-gray-500">
      <Spinner />
      {text}
    </p>
  );
}

interface MessageListProps extends Pick<
  DraftCardProps,
  "onChange" | "onUncertain" | "onCheckAgain"
> {
  entries: TimelineEntry[];
  hasMore: boolean;
  isLoading: boolean;
  /** This page streams the answer. */
  isStreaming: boolean;
  /** The server is on an answer this page does not stream. */
  isAnswering: boolean;
  timedOutDraftIds: Set<string>;
}

/** The conversation, kept scrolled to its end unless the user scrolled up. */
export function MessageList({
  entries,
  hasMore,
  isLoading,
  isStreaming,
  isAnswering,
  timedOutDraftIds,
  onChange,
  onUncertain,
  onCheckAgain,
}: MessageListProps) {
  const list = useRef<HTMLDivElement>(null);
  const isAtEnd = useRef(true);
  const draftCallbacks = { onChange, onUncertain, onCheckAgain };
  const lastEntry = entries[entries.length - 1];
  const isWaiting =
    isStreaming && lastEntry?.type === "message" && lastEntry.role === "user";

  // A turn starts with the message the user just sent: show it
  useEffect(() => {
    if (isStreaming) {
      isAtEnd.current = true;
    }
  }, [isStreaming]);

  useEffect(() => {
    if (list.current && isAtEnd.current) {
      list.current.scrollTop = list.current.scrollHeight;
    }
  }, [entries, isStreaming, isAnswering]);

  return (
    <div
      ref={list}
      role="log"
      aria-label="Conversation"
      // Announced when the answer is complete, not for every few letters
      aria-busy={isStreaming}
      tabIndex={0}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-orange-400"
      onScroll={({ currentTarget }) => {
        const { scrollHeight, scrollTop, clientHeight } = currentTarget;
        isAtEnd.current =
          scrollHeight - scrollTop - clientHeight < END_MARGIN_PX;
      }}
    >
      {hasMore && (
        <p className="text-center text-xs text-gray-500">
          Earlier messages are not shown.
        </p>
      )}
      {entries.length === 0 && isLoading && (
        <Progress text="Loading the conversation…" />
      )}
      {entries.length === 0 && !isLoading && (
        <p className="m-auto max-w-xs text-center text-sm text-gray-500">
          Ask for a change of alert status, for the alerts you selected or for
          the ones that match a description. Nothing changes until you confirm
          it.
        </p>
      )}
      {entries.map((entry) => {
        switch (entry.type) {
          case "message":
            return (
              <MessageBubble
                key={entry.key}
                role={entry.role}
                content={entry.content}
                status={entry.status}
              />
            );
          case "draft":
            return (
              <MemoDraftCard
                key={entry.key}
                draft={entry.draft}
                isTimedOut={timedOutDraftIds.has(entry.draft.id)}
                {...draftCallbacks}
              />
            );
          case "tool":
            return (
              <Fragment key={entry.key}>
                <ToolStatusLine tool={entry.tool} isStreaming={isStreaming} />
                {isStreaming &&
                  entry.tool.phase === "started" &&
                  DRAFT_TOOLS.includes(entry.tool.tool) && (
                    <MemoDraftCard draft={null} {...draftCallbacks} />
                  )}
              </Fragment>
            );
        }
      })}
      {isWaiting && <Progress text="Thinking…" />}
      {isAnswering && <Progress text="The assistant is still answering…" />}
    </div>
  );
}
