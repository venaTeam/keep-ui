import {
  PencilIcon,
  PlayIcon,
  TrashIcon,
  BellSlashIcon,
  BellIcon,
} from "@heroicons/react/24/outline";
import { EllipsisHorizontalIcon } from "@heroicons/react/20/solid";
import { DropdownMenu } from "@/shared/ui";
import { IncidentDto, Status } from "@/entities/incidents/model";
import { useIncidentActions } from "@/entities/incidents/model/useIncidentActions";
import { DismissModal } from "@/features/alerts/dismiss-alert";
import { useState } from "react";

interface Props {
  incident: IncidentDto;
  handleEdit: (incident: IncidentDto) => void;
  handleRunWorkflow: (incident: IncidentDto) => void;
}

export function IncidentDropdownMenu({
  incident,
  handleEdit,
  handleRunWorkflow,
}: Props) {
  const { deleteIncident } = useIncidentActions();

  const [dismissModalIncident, setDismissModalIncident] =
    useState<IncidentDto | null>(null);

  const isDismissed = incident.status === Status.Suppressed;

  return (
    <>
      <DropdownMenu.Menu
        icon={EllipsisHorizontalIcon}
        label=""
        data-cy="incidents-row-menu-btn"
        listDataCy="incidents-row-menu-list"
      >
        <DropdownMenu.Item
          icon={PencilIcon}
          label="Edit"
          data-cy="incidents-row-menu-edit"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleEdit(incident);
          }}
        />
        <DropdownMenu.Item
          icon={PlayIcon}
          label="Run workflow"
          data-cy="incidents-row-menu-run-workflow"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleRunWorkflow(incident);
          }}
        />
        <DropdownMenu.Item
          icon={isDismissed ? BellIcon : BellSlashIcon}
          label={isDismissed ? "Restore" : "Dismiss"}
          data-cy="incidents-row-menu-dismiss"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDismissModalIncident(incident);
          }}
        />
        <DropdownMenu.Item
          icon={TrashIcon}
          label="Delete"
          variant="destructive"
          data-cy="incidents-row-menu-delete"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteIncident(incident.id);
          }}
        />
      </DropdownMenu.Menu>
      <DismissModal
        incident={dismissModalIncident}
        handleClose={() => setDismissModalIncident(null)}
      />
    </>
  );
}
