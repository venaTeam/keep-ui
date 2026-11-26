import { useEffect, useRef } from "react";
import { DraftView } from "@/entities/assistant";
import { useRefreshAlertQueries } from "@/features/alerts/alert-quick-actions/model/use-refresh-alert-queries";

const isOpen = ({ state }: DraftView) =>
  state === "pending" || state === "applying";

/** Whether the alerts may look different now. */
const hasChangedAlerts = ({ outcome }: DraftView) =>
  !!outcome && (outcome.applied_count > 0 || outcome.code === "unverified");

/**
 * Refreshes the alerts once when a draft becomes final, whether by the answer
 * to Confirm or by a later read. Drafts that were final when first seen, as
 * after a reload, refresh nothing.
 */
export function useDraftOutcomeRefresh(drafts: DraftView[]): void {
  const refreshAlerts = useRefreshAlertQueries();
  const openIds = useRef(new Set<string>());

  useEffect(() => {
    const resolved = drafts.filter(
      (draft) => !isOpen(draft) && openIds.current.delete(draft.id)
    );
    drafts.filter(isOpen).forEach(({ id }) => openIds.current.add(id));
    if (resolved.some(hasChangedAlerts)) {
      refreshAlerts();
    }
  }, [drafts, refreshAlerts]);
}
