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
import { AlertDto, Status } from "@/entities/alerts/model";
import {
  DEFAULT_DISPOSE_ON_NEW_ALERT,
  DisposeOnNewAlertToggle,
} from "@/entities/alerts/ui";
import { set, isSameDay, isAfter } from "date-fns";
import { useAlerts } from "@/entities/alerts/model/useAlerts";
import { toast } from "react-toastify";
import { useApi } from "@/shared/lib/hooks/useApi";
import { Select, showErrorToast } from "@/shared/ui";
import { useRevalidateMultiple } from "@/shared/lib/state-utils";
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

interface Props {
  preset: string;
  alert: AlertDto[] | null | undefined;
  handleClose: () => void;
  onSuccess?: () => void;
}

export function AlertDismissModal({
  preset: presetName,
  alert: alerts,
  handleClose,
  onSuccess,
}: Props) {
  const [dismissComment, setDismissComment] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(null);
  const [showError, setShowError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [disposeOnNewAlert, setDisposeOnNewAlert] = useState<boolean>(
    DEFAULT_DISPOSE_ON_NEW_ALERT
  );
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const [commentError, setCommentError] = useState<boolean>(false);

  const isRestore = alerts?.every((a) => a.status === Status.Suppressed);
  const revalidateMultiple = useRevalidateMultiple();
  const presetsMutator = () => revalidateMultiple(["/preset"]);
  const { alertsMutator } = useAlerts();

  const api = useApi();
  const isOpen = !!alerts;

  // Reset transient state every time the modal opens so stale state
  // (e.g. a leftover loading spinner) never carries over between dismissals.
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(false);
    setShowError(false);
    setCommentError(false);
    const now = new Date();
    const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
    const defaultTime = set(now, {
      minutes: roundedMinutes,
      seconds: 0,
      milliseconds: 0,
    });
    setSelectedDateTime(defaultTime);
  }, [isOpen]);

  if (!alerts) return null;

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

    setIsLoading(true);

    const dismissUntil =
      selectedTab === 0 ? null : selectedDateTime?.toISOString();

    const plainTextNote = dismissComment.trim();

    // Send the typed dismiss keys directly.
    // Restore clears the dismiss columns (dismiss_mode/dismissed_until -> null) and
    // applies the chosen status. Dismiss sets dismiss_mode from the selected tab:
    // tab 0 = "Dismiss Forever" -> permanent; tab 1 = "Dismiss Until" -> dismiss_until + dismissed_until.
    // Only snake_case enrichment keys are accepted; unknown keys are rejected (422).
    const enrichments: {
      note: string;
      dismiss_mode: "permanent" | "dismiss_until" | null;
      dismissed_until?: string | null;
      status?: Status | null;
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
        };

    const requestData = {
      enrichments: enrichments,
      fingerprints: alerts.map((alert: AlertDto) => alert.fingerprint),
    };

      const start = performance.now();
  try {
    const endpoint = isRestore
      ? "/alerts/batch_enrich?dispose_on_new_alert=false"
      : `/alerts/batch_enrich?dispose_on_new_alert=${disposeOnNewAlert}`;

    await api.post(endpoint, requestData);
    recordAction("dismiss_alert", (performance.now() - start) / 1000);
    toast.success(
      `${alerts.length} alerts ${isRestore ? "restored" : "dismissed"} successfully!`,
      { position: "top-right" }
    );
    onSuccess?.();
    await alertsMutator();
    await presetsMutator();
  } catch (error) {
    recordError("dismiss_alert");
    showErrorToast(error, "Failed to dismiss alerts");
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

  return (
    <Modal
      onClose={clearAndClose}
      isOpen={isOpen}
      className="overflow-visible"
      beforeTitle={alerts?.[0]?.name}
      title={isRestore ? "Restore Alert(s)" : "Dismiss Alert(s)"}
      data-cy="alerts-dismiss-modal"
    >
      {isRestore ? (
        <>
          <Callout color="orange" title="Restoring Alerts" className="mb-2.5">
            This will restore the alert(s) and set their status.
          </Callout>
          <div className="flex mt-2.5 items-center mb-4">
            <Subtitle className="flex items-center font-bold mr-2">
              New status:
            </Subtitle>
            <Select
              options={Object.values(Status)
                .filter((status) => status !== Status.Pending)
                .map((status) => ({
                  value: status,
                  label: (
                    <div className="flex items-center">
                      {statusIcons[status]}
                      <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    </div>
                  ),
                }))}
              value={
                selectedStatus
                  ? {
                    value: selectedStatus,
                    label: (
                      <div className="flex items-center">
                        {statusIcons[selectedStatus]}
                        <span>
                          {selectedStatus.charAt(0).toUpperCase() +
                            selectedStatus.slice(1)}
                        </span>
                      </div>
                    ),
                  }
                  : null
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
            <Button variant="secondary" color="orange" onClick={clearAndClose} data-cy="alerts-restore-cancel-btn">
              Cancel
            </Button>
            <Button
              onClick={handleDismissChange}
              color="orange"
              loading={isLoading}
              disabled={isLoading}
              data-cy="alerts-restore-submit-btn"
            >
              Restore
            </Button>
          </div>
        </>
      ) : (
        <>
          <Callout color="orange" title="Dismissing Alerts" className="mb-2.5">
            {`This will dismiss the alert until an alert with the same fingerprint comes in${selectedTab === 1 ? ` or until ${selectedDateTime}.` : "."
              }`}
          </Callout>
          <div className="flex justify-end mb-4">
            <DisposeOnNewAlertToggle
              value={disposeOnNewAlert}
              onChange={setDisposeOnNewAlert}
              entityLabel="dismissal"
            />
          </div>
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
            {isRestore ? "Restore Note" : "Dismiss Comment"}{" "}
            {!isRestore && <span className="text-red-500">*</span>}
          </Title>
          <div className="mt-4">
            <Textarea
              value={dismissComment}
              onChange={(e) => {
                setDismissComment(e.target.value);
                setCommentError(false);
              }}
              placeholder={`Add your ${isRestore ? "restore" : "dismiss"
                } note here...`}
              error={commentError}
              errorMessage="Comment is required"
              rows={4}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" color="orange" onClick={clearAndClose} data-cy="alerts-dismiss-cancel-btn">
              Cancel
            </Button>
            <Button
              onClick={handleDismissChange}
              color="orange"
              loading={isLoading}
              disabled={isLoading}
              data-cy="alerts-dismiss-submit-btn"
            >
              Dismiss
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
