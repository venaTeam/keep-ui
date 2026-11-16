import { AlertChangeStatusModal } from "@/features/alerts/alert-change-status";
import { AlertDismissModal } from "@/features/alerts/dismiss-alert";
import { AlertAssociateIncidentModal } from "@/features/alerts/alert-associate-to-incident";
import { QuickActionDialogProps } from "../model/types";

/** The presets page's status dialog: single-alert mode for one alert, batch mode for several. */
export function ChangeStatusDialog({
  alerts,
  presetName,
  onClose,
  onSuccess,
}: QuickActionDialogProps) {
  return (
    <AlertChangeStatusModal
      alert={alerts.length === 1 ? alerts[0] : alerts}
      presetName={presetName}
      handleClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

/** The presets page's dismiss dialog for the given alerts. */
export function DismissDialog({
  alerts,
  presetName,
  onClose,
  onSuccess,
}: QuickActionDialogProps) {
  return (
    <AlertDismissModal
      alert={alerts}
      preset={presetName}
      handleClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

/** The presets page's associate-to-incident dialog, rendered already open. */
export function LinkIncidentDialog({
  alerts,
  onClose,
  onSuccess,
}: QuickActionDialogProps) {
  return (
    <AlertAssociateIncidentModal
      isOpen
      alerts={alerts}
      handleClose={onClose}
      handleSuccess={onSuccess}
    />
  );
}
