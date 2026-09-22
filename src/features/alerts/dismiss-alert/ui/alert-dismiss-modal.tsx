import { useState, useEffect } from "react";
import {
  Button,
  Title,
  Subtitle,
  Card,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Callout,
  Textarea,
} from "@tremor/react";
import Modal from "@/components/ui/Modal";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  AlertDto,
  Status,
  DEFAULT_DISPOSE_ON_NEW_ALERT,
} from "@/entities/alerts/model";
import { DisposeOnNewAlertToggle } from "@/entities/alerts/ui";
import {
  IncidentDto,
  Status as IncidentStatus,
  useIncidentActions,
} from "@/entities/incidents/model";
import { STATUS_ICONS as INCIDENT_STATUS_ICONS } from "@/entities/incidents/ui";
import { getIncidentName } from "@/entities/incidents/lib/utils";
import { set, isSameDay, isAfter } from "date-fns";
import { useAlerts } from "@/entities/alerts/model/useAlerts";
import { toast } from "react-toastify";
import { useApi } from "@/shared/lib/hooks/useApi";
import { Select, showErrorToast } from "@/shared/ui";
import { useRevalidateMultiple } from "@/shared/lib/state-utils";
import { capitalize } from "@/utils/helpers";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PauseIcon,
  CircleStackIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import "./alert-dismiss-modal.css";
import { recordAction, recordError } from "@/utils/metrics";

const statusIcons: any = {
  [Status.Firing]: <ExclamationCircleIcon className="w-5 h-5 text-red-500 mr-2" />,
  [Status.Resolved]: <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" />,
  [Status.Acknowledged]: <PauseIcon className="w-5 h-5 text-gray-500 mr-2" />,
  [Status.Suppressed]: <CircleStackIcon className="w-5 h-5 text-gray-500 mr-2" />,
  [Status.Pending]: <ClockIcon className="w-5 h-5 text-gray-500 mr-2" />,
};

type EntityStatus = Status | IncidentStatus;

type CommonProps = {
  handleClose: () => void;
  onSuccess?: () => void;
};

type AlertProps = CommonProps & {
  preset: string;
  /** Non-empty while the modal is open; null/undefined closes it. */
  alert: AlertDto[] | null | undefined;
  incident?: never;
  initialRestoreStatus?: never;
};

type IncidentProps = CommonProps & {
  /** Non-null while the modal is open; null/undefined closes it. */
  incident: IncidentDto | null | undefined;
  alert?: never;
  preset?: never;
  /**
   * Status to preselect in the restore flow, e.g. the one the user just picked
   * in the status dropdown of a dismissed incident.
   */
  initialRestoreStatus?: IncidentStatus | null;
};

type Props = AlertProps | IncidentProps;

/**
 * Dismiss / restore modal shared by alerts and incidents.
 *
 * Both entities model dismissal the same way: a `dismiss_mode` enrichment
 * (plus `dismissed_until` for timed dismissals) that the backend turns into a
 * "suppressed" status. Only the endpoint and the wording differ.
 */
export function DismissModal(props: Props) {
  const {
    alert: alerts,
    incident,
    initialRestoreStatus,
    handleClose,
    onSuccess,
  } = props;

  const [dismissComment, setDismissComment] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(null);
  const [showError, setShowError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [disposeOnNewAlert, setDisposeOnNewAlert] = useState<boolean>(
    DEFAULT_DISPOSE_ON_NEW_ALERT
  );
  const [selectedStatus, setSelectedStatus] = useState<EntityStatus | null>(
    null
  );
  const [commentError, setCommentError] = useState<boolean>(false);

  const isIncident = !!incident;
  const entityLabel = isIncident ? "incident" : "alert";
  const isRestore = isIncident
    ? incident.status === IncidentStatus.Suppressed
    : alerts?.every((a) => a.status === Status.Suppressed);

  const revalidateMultiple = useRevalidateMultiple();
  const presetsMutator = () => revalidateMultiple(["/preset"]);
  const { alertsMutator } = useAlerts();
  const { enrichIncident, mutateIncident, mutateIncidentsList } =
    useIncidentActions();

  const api = useApi();
  const isOpen = !!alerts || !!incident;

  // Reset transient state every time the modal opens so stale state
  // (e.g. a leftover loading spinner) never carries over between dismissals.
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(false);
    setShowError(false);
    setCommentError(false);
    setSelectedStatus(initialRestoreStatus ?? null);
    const now = new Date();
    const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
    const defaultTime = set(now, {
      minutes: roundedMinutes,
      seconds: 0,
      milliseconds: 0,
    });
    setSelectedDateTime(defaultTime);
  }, [isOpen, initialRestoreStatus]);

  if (!alerts && !incident) return null;

  // Statuses an entity can be restored *to*. "Suppressed" is excluded because
  // that is the state being left, and "merged"/"pending" are not user-settable.
  const restoreStatusOptions = (
    isIncident
      ? Object.values(IncidentStatus).filter(
          (status) =>
            status !== IncidentStatus.Suppressed &&
            status !== IncidentStatus.Merged
        )
      : Object.values(Status).filter((status) => status !== Status.Pending)
  ).map((status) => ({
    value: status as EntityStatus,
    label: (
      <div className="flex items-center">
        {isIncident
          ? INCIDENT_STATUS_ICONS[status as IncidentStatus]
          : statusIcons[status]}
        <span>{capitalize(status)}</span>
      </div>
    ),
  }));

  const handleTabChange = (index: number) => {
    setSelectedTab(index);
    if (index === 0) {
      setSelectedDateTime(null);
      setShowError(false);
    }
  };

  const handleDateTimeChange = (date: Date) => {
    setSelectedDateTime(date);
    setShowError(false);
  };

  const handleDismissChange = async () => {
    if (selectedTab === 1 && !selectedDateTime) {
      setShowError(true);
      return;
    }

    if (!isRestore && !dismissComment.trim()) {
      setCommentError(true);
      return;
    }

    // An incident's status is a real column, so restoring has to name the
    // status to move it to — there is nothing to fall back to.
    if (isIncident && isRestore && !selectedStatus) {
      showErrorToast(new Error("Please select a status to restore to."));
      return;
    }

    setIsLoading(true);

    const dismissUntil =
      selectedTab === 0 ? null : selectedDateTime?.toISOString();

    const plainTextNote = dismissComment.trim();

    // Send the typed dismiss keys directly.
    // Restore clears the dismiss columns (dismiss_mode/dismissed_until -> null) and
    // applies the chosen status. Dismiss sets dismiss_mode from the selected tab:
    // tab 0 = "Dismiss Forever" -> permanent; tab 1 = "Dismiss Until" -> dismiss_until + dismissed_until.
    // Only snake_case enrichment keys are accepted; unknown keys are rejected (422).
    //
    // `status` travels in the same body for both entities. Alerts merge
    // enrichments over the event, so it restores them directly. For incidents
    // the enrich endpoint splits it back out and applies it to the real status
    // column, in one transaction with the note — so a dismissal and its note
    // can no longer half-apply. A dismissal must say `suppressed`: the dismiss
    // keys without it are rejected, since dismissal IS that status.
    const enrichments: {
      note: string;
      dismiss_mode: "permanent" | "dismiss_until" | null;
      dismissed_until?: string | null;
      status?: EntityStatus | null;
    } = isRestore
      ? {
          dismiss_mode: null,
          dismissed_until: null,
          note: plainTextNote,
          ...(selectedStatus && { status: selectedStatus }),
        }
      : {
          dismiss_mode: selectedTab === 0 ? "permanent" : "dismiss_until",
          ...(dismissUntil && { dismissed_until: dismissUntil }),
          note: plainTextNote,
          ...(isIncident && { status: IncidentStatus.Suppressed }),
        };

    const start = performance.now();
    try {
      if (isIncident) {
        // One request: /incidents/{id}/enrich routes `status` and the dismiss
        // keys to the incident's typed columns and the rest to the enrichments
        // blob, committing both together. This used to be two calls, which could
        // leave the note saved with the dismissal missing (or, worse, the status
        // call defaulting to a permanent dismissal and discarding the deadline).
        await enrichIncident(incident.id, enrichments);
        recordAction("dismiss_incident", (performance.now() - start) / 1000);
        toast.success(
          `Incident ${isRestore ? "restored" : "dismissed"} successfully!`,
          { position: "top-right" }
        );
        onSuccess?.();
        mutateIncidentsList();
        mutateIncident(incident.id);
      } else {
        const endpoint = isRestore
          ? "/alerts/batch_enrich?dispose_on_new_alert=false"
          : `/alerts/batch_enrich?dispose_on_new_alert=${disposeOnNewAlert}`;

        await api.post(endpoint, {
          enrichments: enrichments,
          fingerprints: alerts!.map((alert: AlertDto) => alert.fingerprint),
        });
        recordAction("dismiss_alert", (performance.now() - start) / 1000);
        toast.success(
          `${alerts!.length} alerts ${isRestore ? "restored" : "dismissed"} successfully!`,
          { position: "top-right" }
        );
        onSuccess?.();
        await alertsMutator();
        await presetsMutator();
      }
    } catch (error) {
      recordError(isIncident ? "dismiss_incident" : "dismiss_alert");
      showErrorToast(
        error,
        `Failed to ${isRestore ? "restore" : "dismiss"} ${isIncident ? "incident" : "alerts"}`
      );
    } finally {
      clearAndClose();
    }
  };

  const clearAndClose = () => {
    setSelectedTab(0);
    setSelectedDateTime(null);
    setDismissComment("");
    setShowError(false);
    setCommentError(false);
    setDisposeOnNewAlert(DEFAULT_DISPOSE_ON_NEW_ALERT);
    setSelectedStatus(null);
    setIsLoading(false);
    handleClose();
  };

  const filterPassedTime = (time: Date) => {
    const currentDate = new Date();
    const selectedDate = new Date(time);

    if (isSameDay(currentDate, selectedDate)) {
      return isAfter(selectedDate, currentDate);
    }

    return true;
  };

  const entityTitle = isIncident ? "Incident" : "Alert(s)";

  return (
    <Modal
      onClose={clearAndClose}
      isOpen={isOpen}
      className="overflow-visible"
      beforeTitle={isIncident ? getIncidentName(incident) : alerts?.[0]?.name}
      title={`${isRestore ? "Restore" : "Dismiss"} ${entityTitle}`}
      data-cy={`${entityLabel}s-dismiss-modal`}
    >
      {isRestore ? (
        <>
          <Callout
            color="orange"
            title={`Restoring ${entityTitle}`}
            className="mb-2.5"
          >
            {isIncident
              ? "This will restore the incident and set its status."
              : "This will restore the alert(s) and set their status."}
          </Callout>
          <div className="flex mt-2.5 items-center mb-4">
            <Subtitle className="flex items-center font-bold mr-2">
              New status:
            </Subtitle>
            <Select
              options={restoreStatusOptions}
              value={
                restoreStatusOptions.find(
                  (option) => option.value === selectedStatus
                ) ?? null
              }
              onChange={(option) => setSelectedStatus(option?.value || null)}
              placeholder="Select new status"
              className="w-56"
            />
          </div>
          <Title>Restore Note</Title>
          <div className="mt-4">
            <Textarea
              value={dismissComment}
              onChange={(e) => setDismissComment(e.target.value)}
              placeholder="Add your restore note here..."
              rows={4}
            />
          </div>
          <div className="flex justify-end mt-4 space-x-2">
            <Button
              variant="secondary"
              color="orange"
              onClick={clearAndClose}
              data-cy={`${entityLabel}s-restore-cancel-btn`}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDismissChange}
              color="orange"
              loading={isLoading}
              disabled={isLoading}
              data-cy={`${entityLabel}s-restore-submit-btn`}
            >
              Restore
            </Button>
          </div>
        </>
      ) : (
        <>
          <Callout
            color="orange"
            title={`Dismissing ${entityTitle}`}
            className="mb-2.5"
          >
            {isIncident
              ? `This will dismiss the incident and hide it from active views${selectedTab === 1 ? ` until ${selectedDateTime}.` : "."
              }`
              : `This will dismiss the alert until an alert with the same fingerprint comes in${selectedTab === 1 ? ` or until ${selectedDateTime}.` : "."
              }`}
          </Callout>
          {!isIncident && (
            <div className="flex justify-end mb-4">
              <DisposeOnNewAlertToggle
                value={disposeOnNewAlert}
                onChange={setDisposeOnNewAlert}
                entityLabel="dismissal"
              />
            </div>
          )}
          <TabGroup
            index={selectedTab}
            onIndexChange={(index: number) => handleTabChange(index)}
            className="mb-4"
          >
            <TabList>
              <Tab>Dismiss Forever</Tab>
              <Tab>Dismiss Until</Tab>
            </TabList>
            <TabPanels>
              <TabPanel></TabPanel>
              <TabPanel>
                <Card className="relative z-50 mt-4 flex justify-center items-center">
                  <div className="flex flex-col items-center">
                    <DatePicker
                      selected={selectedDateTime}
                      onChange={handleDateTimeChange}
                      showTimeSelect
                      timeFormat="p"
                      timeIntervals={15}
                      timeCaption="Time"
                      dateFormat="MMMM d, yyyy h:mm:ss aa"
                      minDate={new Date()}
                      minTime={set(new Date(), {
                        hours: 0,
                        minutes: 0,
                        seconds: 0,
                      })}
                      maxTime={set(new Date(), {
                        hours: 23,
                        minutes: 59,
                        seconds: 59,
                      })}
                      filterTime={filterPassedTime}
                      inline
                      calendarClassName="custom-datepicker"
                    />
                    {showError && (
                      <div className="text-red-500 mt-2">
                        Must choose a date
                      </div>
                    )}
                  </div>
                </Card>
              </TabPanel>
            </TabPanels>
          </TabGroup>
          <Title>
            Dismiss Comment <span className="text-red-500">*</span>
          </Title>
          <div className="mt-4">
            <Textarea
              value={dismissComment}
              onChange={(e) => {
                setDismissComment(e.target.value);
                setCommentError(false);
              }}
              placeholder="Add your dismiss note here..."
              error={commentError}
              errorMessage="Comment is required"
              rows={4}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              color="orange"
              onClick={clearAndClose}
              data-cy={`${entityLabel}s-dismiss-cancel-btn`}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDismissChange}
              color="orange"
              loading={isLoading}
              disabled={isLoading}
              data-cy={`${entityLabel}s-dismiss-submit-btn`}
            >
              Dismiss
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

/** @deprecated Prefer `DismissModal`, which also handles incidents. */
export const AlertDismissModal = DismissModal;
