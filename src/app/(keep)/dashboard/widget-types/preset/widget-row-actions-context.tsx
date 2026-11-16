import { createContext } from "react";
import type { OpenQuickActionHandler } from "@/features/alerts/alert-quick-actions";

/** What the Alert Table widget's checkbox and row-actions cells read from the table. */
export interface WidgetRowActions {
  /** True while any row is ticked; the row trays hide. */
  isSelecting: boolean;
  /** True on a widget under `QUICK_TRAY_COMPACT_PX`; the trays show icons only. */
  compact: boolean;
  /** Fingerprint of the alert whose single-row dialog is open, if any. */
  openFingerprint: string | null;
  /** Ticks or unticks a row; with `shiftKey` while anything is ticked, the range from the last picked row. */
  onPick: (rowId: string, shiftKey: boolean) => void;
  /** Opens a quick action's dialog for the given alerts, with the button a pointer pressed (null for a keyboard press). */
  onOpenAction: OpenQuickActionHandler;
}

/** Provided around the widget's table while its selection chrome is on; null otherwise. */
export const WidgetRowActionsContext = createContext<WidgetRowActions | null>(
  null
);
