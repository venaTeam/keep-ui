import Modal from "@/components/ui/Modal";
import { Button, Divider, Title } from "@tremor/react";
import { CreateOrUpdateIncidentForm } from "features/incidents/create-or-update-incident";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useIncidents, usePollIncidents } from "@/utils/hooks/useIncidents";
import Loading from "@/app/(keep)/loading";
import { AlertDto } from "@/entities/alerts/model";
import {
  getIncidentName,
  getIncidentNameWithCreationTime,
} from "@/entities/incidents/lib/utils";
import { useApi } from "@/shared/lib/hooks/useApi";
import { Select, showErrorToast } from "@/shared/ui";
import { DEFAULT_INCIDENTS_CHECKED_OPTIONS } from "@/entities/incidents/model/models";

interface AlertAssociateIncidentModalProps {
  isOpen: boolean;
  handleSuccess: () => void;
  handleClose: () => void;
  alerts: Array<AlertDto>;
}

export const AlertAssociateIncidentModal = ({
  isOpen,
  handleSuccess,
  handleClose,
  alerts,
}: AlertAssociateIncidentModalProps) => {
  const [createIncident, setCreateIncident] = useState(false);
  const [isAssociating, setIsAssociating] = useState(false);

  // Only active incidents are valid association targets. Filter by status
  // server-side (via CEL) so the `limit` applies to active incidents rather
  // than being spent on the full, mostly-resolved incident history — otherwise
  // active-but-not-recently-created incidents fall outside the fetched window.
  const activeStatusCel = `status in [${DEFAULT_INCIDENTS_CHECKED_OPTIONS.map(
    (status) => `'${status}'`
  ).join(", ")}]`;

  const {
    data: incidents,
    isLoading,
    mutate,
  } = useIncidents({
    candidate: false,
    predicted: null,
    limit: 100,
    cel: activeStatusCel,
  });
  usePollIncidents(mutate);

  const [selectedIncident, setSelectedIncident] = useState<
    string | undefined
  >();
  const api = useApi();

  const associateAlertsHandler = useCallback(
    async (incidentId: string) => {
      if (isAssociating) return;
      setIsAssociating(true);
      try {
        const response = await api.post(
          `/incidents/${incidentId}/alerts`,
          alerts.map(({ fingerprint }) => fingerprint)
        );
        handleSuccess();
        await mutate();
        toast.success("Alerts associated with incident successfully");
      } catch (error) {
        showErrorToast(
          error,
          "Failed to associated alerts with incident, please contact us if this issue persists."
        );
      } finally {
        setIsAssociating(false);
      }
    },
    [alerts, api, handleSuccess, mutate, isAssociating]
  );

  const handleAssociateAlerts = (e: FormEvent) => {
    e.preventDefault();
    if (selectedIncident) associateAlertsHandler(selectedIncident);
  };

  const showCreateIncidentForm = useCallback(() => setCreateIncident(true), []);

  const hideCreateIncidentForm = useCallback(
    () => setCreateIncident(false),
    []
  );

  const onIncidentCreated = useCallback(
    (incidentId: string) => {
      hideCreateIncidentForm();
      handleClose();
      associateAlertsHandler(incidentId);
    },
    [associateAlertsHandler, handleClose, hideCreateIncidentForm]
  );

  // reset modal state after closing
  useEffect(() => {
    if (!isOpen) {
      hideCreateIncidentForm();
      setSelectedIncident(undefined);
    }
  }, [hideCreateIncidentForm, isOpen]);

  // if this modal should not be open, do nothing
  if (!alerts) {
    return null;
  }

  const renderSelectIncidentForm = () => {
    if (!incidents || incidents.items.length === 0) {
      return (
        <div className="flex flex-col">
          <Title className="text-md text-gray-500 my-4">No incidents yet</Title>

          <Button
            className="flex-1"
            color="orange"
            onClick={showCreateIncidentForm}
            data-cy="alerts-associate-incident-create-new-btn"
          >
            Create a new incident
          </Button>
        </div>
      );
    }

    const selectedIncidentInstance = incidents.items.find(
      (incident) => incident.id === selectedIncident
    );

    return (
      <div className="h-full justify-center">
        <Select
          className="my-2.5"
          placeholder="Select incident"
          isSearchable
          maxMenuHeight={300}
          menuPlacement="auto"
          value={
            selectedIncidentInstance
              ? {
                value: selectedIncident,
                label: getIncidentName(selectedIncidentInstance),
              }
              : null
          }
          onChange={(selectedOption) =>
            setSelectedIncident(selectedOption?.value)
          }
          options={incidents.items?.map((incident) => ({
            value: incident.id,
            label: getIncidentNameWithCreationTime(incident),
          }))}
        />
        <Divider />
        <div className="flex items-center justify-between gap-6">
          <Button
            className="flex-1"
            color="orange"
            onClick={handleAssociateAlerts}
            disabled={!selectedIncidentInstance || isAssociating}
            loading={isAssociating}
            data-cy="alerts-associate-incident-submit-btn"
          >
            Associate {alerts.length} alert{alerts.length > 1 ? "s" : ""}
          </Button>

          <Button
            className="flex-1"
            color="orange"
            variant="secondary"
            onClick={showCreateIncidentForm}
            data-cy="alerts-associate-incident-create-new-alt-btn"
          >
            Create a new incident
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Associate alerts to incident"
      className="w-[600px]"
      data-cy="alerts-associate-incident-modal"
    >
      <div className="relative">
        {isLoading ? (
          <Loading />
        ) : createIncident ? (
          <CreateOrUpdateIncidentForm
            incidentToEdit={null}
            createCallback={onIncidentCreated}
            exitCallback={hideCreateIncidentForm}
          />
        ) : (
          renderSelectIncidentForm()
        )}
      </div>
    </Modal>
  );
};