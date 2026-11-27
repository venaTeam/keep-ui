import { useEffect, useRef } from "react";
import { DraftView } from "@/entities/assistant";
import { useRevalidateMultiple } from "@/shared/lib/state-utils";
import { RefreshKey, splitRefreshKeys } from "../lib/draft-presenter";
import { getRefreshKeys } from "../ui/draft-body-registry";

const isOpen = ({ state }: DraftView) =>
  state === "pending" || state === "applying";

/**
 * Refreshes what a draft may have changed, once, when it becomes final:
 * whether by the answer to Confirm or by a later read. Each kind names its
 * SWR keys, exact or by prefix. Drafts that were final when first seen, as
 * after a reload, refresh nothing.
 */
export function useDraftOutcomeRefresh(
  drafts: DraftView[],
  refreshKeysOf: (draft: DraftView) => RefreshKey[] = getRefreshKeys
): void {
  const revalidate = useRevalidateMultiple();
  const openIds = useRef(new Set<string>());
  const refreshKeysRef = useRef(refreshKeysOf);
  refreshKeysRef.current = refreshKeysOf;

  useEffect(() => {
    const resolved = drafts.filter(
      (draft) => !isOpen(draft) && openIds.current.delete(draft.id)
    );
    drafts.filter(isOpen).forEach(({ id }) => openIds.current.add(id));
    const { prefixes, exact } = splitRefreshKeys(
      resolved.flatMap((draft) => refreshKeysRef.current(draft))
    );
    if (prefixes.length > 0) {
      revalidate(prefixes);
    }
    if (exact.length > 0) {
      revalidate(exact, { isExact: true });
    }
  }, [drafts, revalidate]);
}
