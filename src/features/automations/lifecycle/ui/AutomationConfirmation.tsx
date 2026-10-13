import { Button } from "@tremor/react";
import Modal from "@/components/ui/Modal";
export const DELETE_WARNING =
  "Delete this automation? Deletion stops new executions immediately and may terminate executions already running. It does not wait for running executions to finish. Execution audit records are retained.";
export function AutomationConfirmation({
  action,
  pending,
  blocked = false,
  onCancel,
  onConfirm,
}: {
  action: "delete" | "disable" | null;
  pending: boolean;
  blocked?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title =
    action === "delete" ? "Delete automation" : "Disable automation";
  return (
    <Modal
      isOpen={!!action}
      onClose={() => {
        if (!pending) onCancel();
      }}
      title={title}
      aria-label={title}
      data-cy="automation-confirmation"
    >
      <p>
        {action === "delete"
          ? DELETE_WARNING
          : "Disable this automation? Matching stops immediately. Existing executions can finish."}
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <Button
          variant="secondary"
          data-cy="automation-confirm-cancel"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          color={action === "delete" ? "red" : "orange"}
          data-cy="automation-confirm-submit"
          disabled={pending || blocked}
          loading={pending}
          onClick={onConfirm}
        >
          {title}
        </Button>
      </div>
    </Modal>
  );
}
