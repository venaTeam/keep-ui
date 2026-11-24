import { memo } from "react";
import { TimelineMessage } from "@/entities/assistant";
import { AssistantMarkdown } from "./AssistantMarkdown.dynamic";

const STATUS_TEXTS: Record<TimelineMessage["status"], string | null> = {
  complete: null,
  interrupted: "This answer was interrupted.",
  error: "This answer is not complete.",
};

type MessageBubbleProps = Pick<TimelineMessage, "role" | "content" | "status">;

/**
 * One message. Memoized: while an answer arrives the list renders many times
 * a second, and markdown is parsed on each render.
 */
export const MessageBubble = memo(function MessageBubble({
  role,
  content,
  status,
}: MessageBubbleProps) {
  if (role === "user") {
    return (
      <div
        data-cy="assistant-message"
        data-role={role}
        className="ml-8 self-end whitespace-pre-wrap break-words rounded-lg bg-orange-50 px-3 py-2 text-sm text-gray-900"
        dir="auto"
      >
        {content}
      </div>
    );
  }

  const statusText = STATUS_TEXTS[status];
  return (
    <div
      data-cy="assistant-message"
      data-role={role}
      data-status={status}
      className="min-w-0 text-sm text-gray-900"
    >
      <AssistantMarkdown content={content} />
      {statusText && <p className="mt-1 text-xs text-gray-500">{statusText}</p>}
    </div>
  );
});
