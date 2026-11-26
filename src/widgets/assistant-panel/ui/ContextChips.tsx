import { XMarkIcon } from "@heroicons/react/24/outline";
import { MAX_SELECTED_FINGERPRINTS } from "@/entities/assistant";

const CHIP_CLASSES =
  "flex min-w-0 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700";

function getSelectionText(count: number): string {
  const text = `${count} ${count === 1 ? "alert" : "alerts"} selected`;
  return count > MAX_SELECTED_FINGERPRINTS
    ? `${text}, the first ${MAX_SELECTED_FINGERPRINTS} are sent`
    : text;
}

interface ContextChipsProps {
  page: string;
  /** How many selected alerts go with the next message. */
  selectedCount: number;
  onRemoveSelection: () => void;
}

/** What the next message says about where the user is. */
export function ContextChips({
  page,
  selectedCount,
  onRemoveSelection,
}: ContextChipsProps) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label="Sent with your message"
    >
      {page && (
        <span
          data-cy="assistant-context-chip-page"
          className={CHIP_CLASSES}
          title={page}
        >
          <span className="truncate">Page: {page}</span>
        </span>
      )}
      {selectedCount > 0 && (
        <span
          data-cy="assistant-context-chip-selection"
          className={CHIP_CLASSES}
        >
          <span className="truncate">{getSelectionText(selectedCount)}</span>
          <button
            type="button"
            aria-label="Don't send the selected alerts"
            data-cy="assistant-context-chip-remove"
            className="rounded-full p-0.5 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-400"
            onClick={onRemoveSelection}
          >
            <XMarkIcon className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      )}
    </div>
  );
}
