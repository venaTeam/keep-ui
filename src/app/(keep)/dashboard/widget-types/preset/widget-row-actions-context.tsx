import { createContext } from "react";
import type { AlertDto } from "@/entities/alerts/model/types";

/** What the Alert Table widget's checkbox and row-actions cells read from the table. */
export interface WidgetRowActions {
  /** True while any row is ticked; the row trays hide. */
  isSelecting: boolean;
  /** True on a widget under `QUICK_TRAY_COMPACT_PX`; the trays show icons only. */
  compact: boolean;
  /** Fingerprint of the alert whose single-row dialog is open, if any. */
  openFingerprint: string | null;
  /** Ticks or unticks a row; with `shiftKey`, the range from the last picked row. */
  onPick: (rowId: string, shiftKey: boolean) => void;
  /** Opens a quick action's dialog for the given alerts. */
  onOpenAction: (actionId: string, alerts: AlertDto[]) => void;
}

/** Provided around the widget's table while its selection chrome is on; null otherwise. */
export const WidgetRowActionsContext = createContext<WidgetRowActions | null>(
  null
);
