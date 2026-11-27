import Link from "next/link";
import { AlertOutcome, DraftView } from "@/entities/assistant";
import { CardState } from "../lib/draft-card-state";
import { ResultLabels } from "../lib/draft-presenter";
import { formatTime } from "../lib/format-time";
import { getObjectLink } from "../lib/object-link";

// The results without a label of the kind, as of a newer gateway, listed so
// that none goes missing
const OTHER_LABEL = "Other";

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

/** Whether a discarded draft went on in a form, which is not throwing it away. */
export function isOpenedInForm(draft: DraftView): boolean {
  return (
    draft.state === "discarded" && draft.outcome?.code === "opened_in_form"
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
      return isOpenedInForm(draft)
        ? (message ?? "Opened in the form.")
        : "Discarded";
    case "draft":
    case "streaming":
      return null;
  }
}

function groupResults(
  results: AlertOutcome[],
  labels: ResultLabels,
  state: CardState
) {
  const known = new Set<string>(labels.map(([result]) => result));
  return [
    ...labels.map(([result, label]) => ({
      key: result,
      label,
      results: results.filter((alert) => alert.result === result),
    })),
    {
      key: "other",
      label: OTHER_LABEL,
      results: results.filter((alert) => !known.has(alert.result)),
    },
  ].filter(
    (group) =>
      group.results.length > 0 &&
      // Everything in the list above was changed
      !(state === "saved" && group.key === "applied")
  );
}

interface DraftCardOutcomeProps {
  draft: DraftView;
  state: CardState;
  notPermittedText: string;
  /** The kind's labels of the alert results. */
  resultLabels: ResultLabels;
  /** The page stopped waiting for a change that is still being applied. */
  isTimedOut: boolean;
}

/** What became of the draft, as plain text. */
export function DraftCardOutcome({
  draft,
  state,
  notPermittedText,
  resultLabels,
  isTimedOut,
}: DraftCardOutcomeProps) {
  const text = getText(draft, state, notPermittedText);
  if (!text) {
    return null;
  }
  const time = formatTime(draft.outcome?.finished_at);
  const groups = groupResults(
    draft.outcome?.results ?? [],
    resultLabels,
    state
  );
  const link = getObjectLink(draft.outcome?.object);

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
          key={group.key}
          label={group.label}
          results={group.results}
        />
      ))}
      {link && (
        <Link
          href={link.href}
          data-cy="assistant-draft-object-link"
          className="self-start font-medium text-orange-700 underline hover:text-orange-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-400"
        >
          Open <bdi>{link.name}</bdi>
        </Link>
      )}
    </div>
  );
}
