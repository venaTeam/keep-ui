import { CheckIcon, MinusCircleIcon } from "@heroicons/react/24/outline";
import { ToolOutcome, ToolStatus } from "@/entities/assistant";
import { Spinner } from "./Spinner";

// `tool_limit` is the tool error of a turn past its tool calls
const OUTCOME_TEXTS: Record<ToolOutcome | "tool_limit", string> = {
  draft_created: "draft ready",
  too_many_matches: "too many alerts match",
  no_matches: "no alert matches",
  nothing_to_change: "nothing to change",
  invalid_cel: "the filter is not valid",
  invalid_arguments: "the request is not valid",
  unauthenticated: "your session expired",
  error: "failed",
  found: "found",
  not_found: "not found",
  link_ready: "link ready",
  name_taken: "the name is taken",
  tool_limit: "too many steps for one answer",
};
// An outcome of a newer gateway
const GENERIC_TEXT = "done";

const SUCCEEDED = new Set<string>(["draft_created", "found", "link_ready"]);

// An own key only: the outcome is an open set, "constructor" included
const getOutcomeText = (outcome: string | undefined) => {
  if (!outcome) {
    return undefined;
  }
  return Object.prototype.hasOwnProperty.call(OUTCOME_TEXTS, outcome)
    ? OUTCOME_TEXTS[outcome as keyof typeof OUTCOME_TEXTS]
    : GENERIC_TEXT;
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
  const Icon =
    tool.outcome && SUCCEEDED.has(tool.outcome) ? CheckIcon : MinusCircleIcon;
  return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
}

interface ToolStatusLineProps {
  tool: ToolStatus;
  /** The answer the tool is a part of is still arriving. */
  isStreaming: boolean;
}

/** What the assistant is doing, or did, with one of its tools. */
export function ToolStatusLine({ tool, isStreaming }: ToolStatusLineProps) {
  const outcome = getOutcomeText(tool.outcome);

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
