import { useMemo, useRef, useState } from "react";
import { useLeaveGuard } from "@/shared/lib/hooks/useLeaveGuard";
import { DashboardEditState, dashboardEditKey } from "./dashboard-edit-state";

type EditSession = {
  // What the dashboard looked like when editing started; Cancel restores it.
  snapshot: DashboardEditState;
  snapshotKey: string;
};

interface UseDashboardEditSessionOptions {
  // The dashboard as it is on screen right now.
  current: DashboardEditState;
  // Puts the dashboard back to a given state (used to discard changes).
  restore: (state: DashboardEditState) => void;
  // Closes whatever the page opened while editing (dialogs, panels).
  onStop: () => void;
}

/**
 * One edit session of a dashboard: entering and leaving edit mode, knowing
 * whether there are unsaved changes, and the "Discard unsaved changes?"
 * warning shown before any way out except Save.
 *
 * view ──start──▶ editing ──stop (Save)──────────────▶ view
 *                    │──cancel (no changes)──────────▶ view
 *                    │──requestCancel / leave attempt (changes)
 *                    ▼
 *               warning open ──keepEditing──▶ editing
 *                    └──discardAndLeave──▶ view (+ the held-back navigation)
 */
export function useDashboardEditSession({
  current,
  restore,
  onStop,
}: UseDashboardEditSessionOptions) {
  const [session, setSession] = useState<EditSession | null>(null);
  const [isLeaveWarningOpen, setIsLeaveWarningOpen] = useState(false);
  // The navigation held back by the warning; null for the Cancel button.
  const pendingLeave = useRef<(() => void) | null>(null);

  const isEditMode = session !== null;
  // Serializes the whole dashboard, so only when it changes (not on every
  // render) and only while editing.
  const { layout, widgetData, appearance, dashboardName } = current;
  const currentKey = useMemo(
    () =>
      isEditMode
        ? dashboardEditKey({ layout, widgetData, appearance, dashboardName })
        : null,
    [isEditMode, layout, widgetData, appearance, dashboardName]
  );
  const hasUnsavedChanges =
    session !== null && session.snapshotKey !== currentKey;

  useLeaveGuard(hasUnsavedChanges, (proceed) => {
    pendingLeave.current = proceed;
    setIsLeaveWarningOpen(true);
  });

  const start = (state: DashboardEditState = current) =>
    setSession({
      snapshot: structuredClone(state),
      snapshotKey: dashboardEditKey(state),
    });

  const stop = () => {
    pendingLeave.current = null;
    setIsLeaveWarningOpen(false);
    setSession(null);
    onStop();
  };

  // Leave edit mode and throw the changes away, without asking.
  const cancel = () => {
    if (session) {
      restore(session.snapshot);
    }
    stop();
  };

  // The Cancel button: asks first when there are changes.
  const requestCancel = () => {
    if (hasUnsavedChanges) {
      pendingLeave.current = null;
      setIsLeaveWarningOpen(true);
    } else {
      cancel();
    }
  };

  const keepEditing = () => {
    pendingLeave.current = null;
    setIsLeaveWarningOpen(false);
  };

  const discardAndLeave = () => {
    const proceed = pendingLeave.current;
    cancel();
    proceed?.();
  };

  return {
    isEditMode,
    hasUnsavedChanges,
    isLeaveWarningOpen,
    start,
    stop,
    cancel,
    requestCancel,
    keepEditing,
    discardAndLeave,
  };
}
