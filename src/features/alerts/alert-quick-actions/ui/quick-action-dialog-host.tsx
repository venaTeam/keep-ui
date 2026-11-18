import { getQuickAction } from "../model/actions";
import { OpenQuickAction } from "../model/types";

interface QuickActionDialogHostProps {
  open: OpenQuickAction | null;
  presetName: string;
  onClose: () => void;
  onSuccess: () => void;
}

/** Renders the open quick action's dialog for the alerts it opened with; nothing when closed, unknown or empty. */
export function QuickActionDialogHost({
  open,
  presetName,
  onClose,
  onSuccess,
}: QuickActionDialogHostProps) {
  const action = open ? getQuickAction(open.actionId) : undefined;
  if (!open || !action || open.alerts.length === 0) {
    return null;
  }
  const { Dialog } = action;
  return (
    <Dialog
      alerts={open.alerts}
      presetName={presetName}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
