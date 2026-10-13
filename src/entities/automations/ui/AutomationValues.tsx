import { Badge } from "@tremor/react";
import { Tooltip } from "@/shared/ui/Tooltip";
import { BuildState, MatchingState } from "../model/types";

export function AutomationState({
  state,
}: {
  state: MatchingState | BuildState;
}) {
  return (
    <Badge
      color={
        state === "active"
          ? "green"
          : state === "build_failed"
            ? "red"
            : state === "building" || state === "deleting"
              ? "orange"
              : "gray"
      }
    >
      {state}
    </Badge>
  );
}
export function AutomationDigest({
  digest,
  full = false,
}: {
  digest: string | null;
  full?: boolean;
}) {
  if (!digest?.trim()) return <span>Not built</span>;
  if (full) return <code className="break-all">{digest}</code>;
  const hash = digest.includes("sha256:")
    ? digest.split("sha256:").pop()!
    : digest;
  return (
    <Tooltip content={digest} asChild>
      <code tabIndex={0}>{hash.slice(0, 12)}</code>
    </Tooltip>
  );
}
