import { RowSelectionState } from "@tanstack/react-table";
import { AlertDto } from "@/entities/alerts/model/types";
import { WidgetAlertAction } from "./types";

/** Drops selected ids that are no longer shown, returning the same object when nothing is dropped. */
export function pruneSelection(
  selection: RowSelectionState,
  shownIds: readonly string[]
): RowSelectionState {
  const shown = new Set(shownIds);
  if (Object.keys(selection).every((id) => shown.has(id))) {
    return selection;
  }
  return Object.fromEntries(
    Object.entries(selection).filter(([id]) => shown.has(id))
  );
}

/** A new selection with the ids ticked or unticked; an unticked id is removed, so the result never holds `false`. */
export function setIdsTicked(
  selection: RowSelectionState,
  ids: readonly string[],
  tick: boolean
): RowSelectionState {
  const next: RowSelectionState = Object.fromEntries(
    Object.entries(selection).filter(([, ticked]) => ticked)
  );
  ids.forEach((id) => {
    if (tick) {
      next[id] = true;
    } else {
      delete next[id];
    }
  });
  return next;
}

/** Ids from the anchor to the target inclusive, in display order; just the target when either is not shown. */
export function getRangeIds(
  orderedIds: readonly string[],
  fromId: string,
  toId: string
): string[] {
  const from = orderedIds.indexOf(fromId);
  const to = orderedIds.indexOf(toId);
  if (from === -1 || to === -1) {
    return [toId];
  }
  return orderedIds.slice(Math.min(from, to), Math.max(from, to) + 1);
}

/** The alerts the action applies to, in their original order. */
export function getEligibleAlerts(
  action: WidgetAlertAction,
  alerts: readonly AlertDto[]
): AlertDto[] {
  return alerts.filter((alert) => action.appliesTo(alert));
}

/** The action's plain label when every selected alert is eligible, otherwise its counted partial label. */
export function getStripLabel(
  action: WidgetAlertAction,
  eligibleCount: number,
  selectedCount: number
): string {
  return eligibleCount === selectedCount
    ? action.label
    : action.partialLabel(eligibleCount);
}
