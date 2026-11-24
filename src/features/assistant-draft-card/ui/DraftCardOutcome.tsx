import { AlertOutcome, AlertResult, DraftView } from "@/entities/assistant";
import { CardState } from "../lib/draft-card-state";
import { formatTime } from "../lib/format-time";

const RESULT_LABELS: [AlertResult, string][] = [
  ["applied", "Changed"],
  ["failed", "Not changed"],
  ["unconfirmed", "Not confirmed"],
  ["skipped", "Skipped"],
  ["not_found", "Not found"],
];

function ResultList({
  label,
  results,
}: {
  label: string;
  results: AlertOutcome[];
}) {
  return (
    <div>
      <p className="font-medium">
        {label} ({results.length})
      </p>
      <ul className="list-inside list-disc">
        {results.map(({ fingerprint, name }) => (
          <li key={fingerprint} className="truncate" title={fingerprint}>
            <bdi>{name ?? fingerprint}</bdi>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getText(
  draft: DraftView,
  state: CardState,
  notPermittedText: string
): string | null {
  const message = draft.outcome?.message;
  switch (state) {
    case "submitting":
      return message ?? "Applying the change…";
    case "read-only":
      return message ?? "Keep is in read-only mode.";
    case "not-permitted":
      return notPermittedText;
    case "expired":
      return "Draft expired, ask again";
    case "saved":
      return message ?? "The change was made.";
    case "partial":
      return message ?? "Some alerts were changed.";
    case "error":
      return message ?? "The change failed.";
    case "declined":
      return "Discarded";
    case "draft":
    case "streaming":
      return null;
  }
}

interface DraftCardOutcomeProps {
  draft: DraftView;
  state: CardState;
  notPermittedText: string;
  /** The page stopped waiting for a change that is still being applied. */
  isTimedOut: boolean;
}

/** What became of the draft, as plain text. */
export function DraftCardOutcome({
  draft,
  state,
  notPermittedText,
  isTimedOut,
}: DraftCardOutcomeProps) {
  const text = getText(draft, state, notPermittedText);
  if (!text) {
    return null;
  }
  const time = formatTime(draft.outcome?.finished_at);
  const results = draft.outcome?.results ?? [];
  const groups = RESULT_LABELS.map(([result, label]) => ({
    result,
    label,
    results: results.filter((alert) => alert.result === result),
  })).filter(
    (group) =>
      group.results.length > 0 &&
      // Everything in the list above was changed
      !(state === "saved" && group.result === "applied")
  );

  return (
    <div
      data-cy="assistant-draft-outcome"
      className="flex flex-col gap-1 break-words text-xs"
    >
      <p className="whitespace-pre-wrap font-medium">
        {text}
        {time && <span className="font-normal text-gray-500"> · {time}</span>}
      </p>
      {isTimedOut && state === "submitting" && (
        <p>This is taking longer than usual.</p>
      )}
      {groups.map((group) => (
        <ResultList
          key={group.result}
          label={group.label}
          results={group.results}
        />
      ))}
    </div>
  );
}
