import { DraftView } from "@/entities/assistant";

/** A draft this build does not know: its content, as it is. */
export function GenericDraftBody({ draft }: { draft: DraftView }) {
  return (
    <div className="flex flex-col gap-2 text-xs text-gray-700">
      <p>
        This version of Keep can&apos;t show this draft, so it can&apos;t be
        confirmed here. Reload the page and look again.
      </p>
      <pre
        // Scrolls with the keyboard too
        tabIndex={0}
        aria-label="Draft content"
        className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded border border-gray-200 bg-white p-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-400"
      >
        {JSON.stringify({ kind: draft.kind, ...draft.payload }, null, 2)}
      </pre>
    </div>
  );
}
