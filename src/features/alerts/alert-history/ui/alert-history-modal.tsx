import { Fragment, useState } from "react";
import { AlertDto, AlertKnownKeys, AuditEvent } from "@/entities/alerts/model";
import { AlertTable } from "@/widgets/alerts-table/ui/alert-table";
import { useAlertTableCols } from "@/widgets/alerts-table/lib/alert-table-utils";
import { Button, Flex, Subtitle, Title, Divider } from "@tremor/react";
import AlertHistoryCharts from "./alert-history-charts";
import { useAlerts } from "@/entities/alerts/model/useAlerts";
import { useRouter, useSearchParams } from "next/navigation";
import { toDateObjectWithFallback } from "@/utils/helpers";
import Image from "next/image";
import Modal from "@/components/ui/Modal";
import { AlertNoteModal } from "@/features/alerts/alert-note";
import { AlertTimeline } from "@/features/alerts/alert-detail-sidebar/ui/alert-timeline";

interface AlertHistoryPanelProps {
  selectedAlert: AlertDto | null;
  alertsHistoryWithDate: (Omit<AlertDto, "lastReceived"> & {
    lastReceived: Date;
  })[];
  activity: AuditEvent[];
  isLoading: boolean;
  onRefresh: () => void;
  presetName: string;
}

const AlertHistoryPanel = ({
  selectedAlert,
  alertsHistoryWithDate,
  activity,
  isLoading,
  onRefresh,
  presetName,
}: AlertHistoryPanelProps) => {
  const router = useRouter();
  const [noteModalAlert, setNoteModalAlert] = useState<AlertDto | null>(null);

  const additionalColsToGenerate = [
    ...new Set(
      alertsHistoryWithDate.flatMap((alert) => {
        const keys = Object.keys(alert).filter(
          (key) => !AlertKnownKeys.includes(key)
        );
        return keys.flatMap((key) => {
          if (
            typeof alert[key as keyof AlertDto] === "object" &&
            alert[key as keyof AlertDto] !== null
          ) {
            return Object.keys(alert[key as keyof AlertDto] as object).map(
              (subKey) => `${key}.${subKey}`
            );
          }
          return key;
        });
      })
    ),
  ];

  const alertTableColumns = useAlertTableCols({
    additionalColsToGenerate: additionalColsToGenerate,
    setNoteModalAlert: setNoteModalAlert,
    presetName: alertsHistoryWithDate.at(0)?.fingerprint ?? "",
  });

  const sortedHistoryAlert = alertsHistoryWithDate.map((alert) =>
    alert.lastReceived.getTime()
  );

  const maxLastReceived = new Date(Math.max(...sortedHistoryAlert));
  const minLastReceived = new Date(Math.min(...sortedHistoryAlert));

  // While the history request is in flight (SWR returns undefined data),
  // show the loading bounce. Once data has arrived, render whichever
  // sections (occurrences and/or activity) are non-empty.
  if (isLoading) {
    return (
      <div className="flex justify-center">
        <Image
          className="animate-bounce"
          src="/keep.svg"
          alt="loading"
          width={200}
          height={200}
        />
      </div>
    );
  }

  if (alertsHistoryWithDate.length === 0 && activity.length === 0) {
    return (
      <Flex alignItems="center" justifyContent="center" className="py-12">
        <Subtitle>No history available for this alert.</Subtitle>
      </Flex>
    );
  }

  const hasOccurrences = alertsHistoryWithDate.length > 0;
  const headerName =
    alertsHistoryWithDate.at(0)?.name ?? selectedAlert?.name ?? "";

  return (
    <Fragment>
      <Flex alignItems="center" justifyContent="between">
        <div className="w-11/12">
          <Title className="truncate">History of: {headerName}</Title>
          {hasOccurrences && (
            <>
              <Subtitle>
                Showing: {alertsHistoryWithDate.length} alerts (1000 maximum)
              </Subtitle>
              <Subtitle>First Occurence: {minLastReceived.toString()}</Subtitle>
              <Subtitle>Last Occurence: {maxLastReceived.toString()}</Subtitle>
            </>
          )}
        </div>
        <Button
          className="mt-2 bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300"
          onClick={() => router.replace(`/alerts/${presetName.toLowerCase()}`)}
          data-cy="alerts-history-close-btn"
        >
          Close
        </Button>
      </Flex>
      <Divider />
      {hasOccurrences && (
        <>
          <AlertHistoryCharts
            maxLastReceived={maxLastReceived}
            minLastReceived={minLastReceived}
            alerts={alertsHistoryWithDate}
          />
          <Divider />
          <AlertTable
            alerts={alertsHistoryWithDate}
            columns={alertTableColumns}
            isMenuColDisplayed={false}
            isRefreshAllowed={false}
            presetName="alert-history"
          />
        </>
      )}
      {activity.length > 0 && (
        <>
          <Divider />
          {/* Reuse the alert-detail-sidebar timeline: it handles UTC-naive
              timestamps, action icons, system/user avatars, and note parsing —
              matches the rendering elsewhere in the app. */}
          <AlertTimeline
            alert={selectedAlert}
            auditData={activity}
            isLoading={false}
            onRefresh={onRefresh}
          />
        </>
      )}
      <AlertNoteModal
        handleClose={() => setNoteModalAlert(null)}
        alert={noteModalAlert ?? null}
        readOnly={true}
      />
    </Fragment>
  );
};

interface Props {
  alerts: AlertDto[];
  presetName: string;
  onClose: () => void;
}

export function AlertHistoryModal({ alerts, presetName, onClose }: Props) {
  const searchParams = useSearchParams();
  const selectedAlert = alerts.find((alert) =>
    searchParams
      ? searchParams.get("fingerprint") === alert.fingerprint
      : undefined
  );

  const { useAlertHistory } = useAlerts();
  const {
    data: alertHistory,
    isLoading,
    mutate,
  } = useAlertHistory(selectedAlert, {
    revalidateOnFocus: false,
  });

  // `occurrences`/`activity` may be undefined while loading; guard for the new shape.
  const occurrences = alertHistory?.occurrences ?? [];
  const activity = alertHistory?.activity ?? [];

  const alertsHistoryWithDate = occurrences.map((alert) => ({
    ...alert,
    lastReceived: toDateObjectWithFallback(alert.lastReceived),
  }));

  return (
    <Modal
      isOpen={selectedAlert !== undefined}
      onClose={onClose}
      className="w-full max-w-screen-2xl max-h-[710px] transform overflow-scroll ring-tremor bg-white
                    p-6 text-left align-middle shadow-tremor transition-all rounded-xl"
      data-cy="alerts-history-modal"
    >
      <AlertHistoryPanel
        selectedAlert={selectedAlert ?? null}
        alertsHistoryWithDate={alertsHistoryWithDate}
        activity={activity}
        isLoading={isLoading || alertHistory === undefined}
        onRefresh={() => mutate()}
        presetName={presetName}
      />
    </Modal>
  );
}
