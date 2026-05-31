import { AlertDto } from "@/entities/alerts/model";
import Modal from "@/components/ui/Modal";
import { Button } from "@tremor/react";
import React, { useMemo } from "react";
import { MonacoEditor, showSuccessToast, showErrorToast } from "@/shared/ui";
import { Copy } from "lucide-react";

interface ViewAlertModalProps {
  alert: AlertDto | null | undefined;
  handleClose: () => void;
}

/**
 * Read-only alert payload viewer.
 *
 * Phase 2: the previous ViewAlertModal was a Monaco-based editor (unlock -> edit ->
 * Save) that let users write arbitrary enrichment keys; that path was removed
 * because the strict enrichment allow-list rejects unknown keys with HTTP 422.
 * This restores the harmless read-only "View Alert" payload view (no editing).
 */
export const ViewAlertModal: React.FC<ViewAlertModalProps> = ({
  alert,
  handleClose,
}) => {
  const isOpen = !!alert;

  const payload = useMemo(() => {
    if (!alert) {
      return "";
    }
    const alertData: Record<string, any> = { ...alert };
    // Convert Date objects to ISO strings for readable JSON.
    Object.keys(alertData).forEach((key) => {
      if (alertData[key] instanceof Date) {
        alertData[key] = alertData[key].toISOString();
      }
    });
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(alertData).filter(([key]) => key !== "enriched_fields")
      ),
      null,
      2
    );
  }, [alert]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      showSuccessToast("Alert copied to clipboard");
    } catch (error) {
      showErrorToast(error, "Failed to copy alert to clipboard");
    }
  };

  return (
    <Modal
      onClose={handleClose}
      isOpen={isOpen}
      beforeTitle={alert?.name}
      title="Alert Payload"
      className="overflow-visible max-w-[800px]"
    >
      <div className="flex justify-end mb-2">
        <Button
          color="orange"
          variant="secondary"
          size="xs"
          icon={Copy}
          onClick={handleCopy}
        >
          Copy
        </Button>
      </div>
      <div className="h-[600px]">
        <MonacoEditor
          height="100%"
          defaultLanguage="json"
          value={payload}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
          }}
          theme="vs-light"
        />
      </div>
    </Modal>
  );
};
