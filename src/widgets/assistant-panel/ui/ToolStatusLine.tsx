import { CheckIcon, MinusCircleIcon } from "@heroicons/react/24/outline";
import { ToolOutcome, ToolStatus } from "@/entities/assistant";
import { Spinner } from "./Spinner";

const OUTCOME_TEXTS: Record<ToolOutcome, string> = {
  draft_created: "draft ready",
  too_many_matches: "too many alerts match",
  no_matches: "no alert matches",
  nothing_to_change: "nothing to change",
  invalid_cel: "the filter is not valid",
  invalid_arguments: "the request is not valid",
  unauthenticated: "your session expired",
  error: "failed",
};

function StatusIcon({
  tool,
  isRunning,
}: {
  tool: ToolStatus;
  isRunning: boolean;
}) {
  if (isRunning) {
    return <Spinner />;
  }
  const Icon = tool.outcome === "draft_created" ? CheckIcon : MinusCircleIcon;
  return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
}

interface ToolStatusLineProps {
  tool: ToolStatus;
  /** The answer the tool is a part of is still arriving. */
  isStreaming: boolean;
}

/** What the assistant is doing, or did, with one of its tools. */
export function ToolStatusLine({ tool, isStreaming }: ToolStatusLineProps) {
  const outcome = tool.outcome && OUTCOME_TEXTS[tool.outcome];

  return (
    <p
      data-cy="assistant-tool-status"
      data-outcome={tool.outcome}
      className="flex items-center gap-1.5 text-xs text-gray-500"
    >
      <StatusIcon
        tool={tool}
        isRunning={tool.phase === "started" && isStreaming}
      />
      <span className="min-w-0 break-words">
        {tool.label}
        {outcome && `: ${outcome}`}
      </span>
    </p>
  );
}
