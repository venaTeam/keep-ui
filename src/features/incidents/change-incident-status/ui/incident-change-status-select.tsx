import clsx from "clsx";
import { IncidentDto, Status } from "@/entities/incidents/model";
import { STATUS_ICONS } from "@/entities/incidents/ui";
import Select, { ClassNamesConfig } from "react-select";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { capitalize } from "@/utils/helpers";
import { DismissModal } from "@/features/alerts/dismiss-alert";
import { IncidentChangeStatusModal } from "./incident-change-status-modal";

const customClassNames: ClassNamesConfig<any, false, any> = {
  container: () => "inline-flex",
  control: (state) =>
    clsx(
      "p-1 min-w-14 !rounded-full !min-h-0",
      state.isFocused ? "border-orange-500" : ""
    ),
  valueContainer: () => "!p-0",
  dropdownIndicator: () => "!p-0",
  indicatorSeparator: () => "hidden",
  menuList: () => "!p-0",
  menu: () => "!p-0 !overflow-hidden min-w-36",
  option: (state) =>
    clsx(
      "!p-1",
      state.isSelected ? "!bg-orange-500 !text-white [&_svg]:text-white" : "",
      state.isFocused && !state.isSelected ? "!bg-slate-100" : ""
    ),
};

type Props = {
  incident: IncidentDto;
  onChange?: (status: Status) => void;
  className?: string;
};

export function IncidentChangeStatusSelect({
  incident,
  onChange,
  className,
}: Props) {
  const incidentId = incident.id;
  // Use a portal to render the menu outside the table container with overflow: hidden
  const menuPortalTarget = useRef<HTMLElement | null>(null);
  const [currentStatus, setCurrentStatus] = useState(incident.status);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null);
  const [dismissModalIncident, setDismissModalIncident] =
    useState<IncidentDto | null>(null);
  const [pendingRestoreStatus, setPendingRestoreStatus] =
    useState<Status | null>(null);
  useEffect(() => {
    menuPortalTarget.current = document.body;
  }, []);

  // Keep internal status in sync with prop
  useEffect(() => {
    setCurrentStatus(incident.status);
  }, [incident.status]);

  const statusOptions = useMemo(
    () =>
      Object.values(Status).map((status) => ({
        value: status,
        label: (
          <div className="flex items-center">
            {STATUS_ICONS[status]}
            <span>{capitalize(status)}</span>
          </div>
        ),
      })),
    []
  );

  const handleChange = useCallback(
    (option: any) => {
      const nextStatus: Status | undefined = option?.value;
      if (!nextStatus || nextStatus === currentStatus) {
        return;
      }

      // Dismissing has its own flow: it needs the "forever / until" choice and
      // writes dismiss_mode enrichments rather than a plain status change.
      if (nextStatus === Status.Suppressed) {
        setPendingRestoreStatus(null);
        setDismissModalIncident(incident);
        return;
      }

      // Leaving the dismissed state has to clear those same enrichments, so
      // route it through the restore flow with the picked status preselected.
      if (currentStatus === Status.Suppressed) {
        setPendingRestoreStatus(nextStatus);
        setDismissModalIncident(incident);
        return;
      }

      setPendingStatus(nextStatus);
      setIsModalOpen(true);
    },
    [currentStatus, incident]
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setPendingStatus(null);
  }, []);

  const handleModalSuccess = useCallback(
    (newStatus: Status) => {
      setCurrentStatus(newStatus);
      onChange?.(newStatus);
    },
    [onChange]
  );

  const handleDismissSuccess = useCallback(() => {
    const newStatus =
      currentStatus === Status.Suppressed
        ? pendingRestoreStatus
        : Status.Suppressed;
    if (newStatus) {
      setCurrentStatus(newStatus);
      onChange?.(newStatus);
    }
  }, [currentStatus, pendingRestoreStatus, onChange]);

  const selectedOption = useMemo(
    () => statusOptions.find((option) => option.value === currentStatus),
    [statusOptions, currentStatus]
  );

  return (
    <>
      <div data-cy="incidents-status-select" data-cy-id={incidentId}>
        <Select
          instanceId={`incident-status-select-${incidentId}`}
          className={className}
          isSearchable={false}
          options={statusOptions}
          value={selectedOption}
          onChange={handleChange}
          placeholder="Status"
          classNames={customClassNames}
          menuPortalTarget={menuPortalTarget.current}
          menuPosition="fixed"
        />
      </div>
      <IncidentChangeStatusModal
        incidentId={incidentId}
        currentStatus={currentStatus}
        initialStatus={pendingStatus}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
      <DismissModal
        incident={dismissModalIncident}
        initialRestoreStatus={pendingRestoreStatus}
        handleClose={() => {
          setDismissModalIncident(null);
          setPendingRestoreStatus(null);
        }}
        onSuccess={handleDismissSuccess}
      />
    </>
  );
}
