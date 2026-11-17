import { Button } from "@tremor/react";
import Modal from "@/components/ui/Modal";

interface LeaveEditModeModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onContinue: () => void;
}

export function LeaveEditModeModal({
  isOpen,
  onCancel,
  onContinue,
}: LeaveEditModeModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Discard unsaved changes?"
      className="w-[480px]"
      data-cy="dashboard-leave-modal"
    >
      <div className="flex flex-col gap-4">
        <p>
          You have unsaved changes to this dashboard. If you continue, the
          changes you made so far will be lost.
        </p>
        <div className="flex justify-between gap-2">
          <Button
            variant="secondary"
            size="sm"
            color="orange"
            onClick={onCancel}
            data-cy="dashboard-leave-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            color="orange"
            onClick={onContinue}
            data-cy="dashboard-leave-continue-btn"
          >
            Continue
          </Button>
        </div>
      </div>
    </Modal>
  );
}
