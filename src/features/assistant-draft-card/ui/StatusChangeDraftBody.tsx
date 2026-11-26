import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Badge } from "@tremor/react";
import { ChangeAlertStatusPayload, DraftAlert } from "@/entities/assistant";
import { getStatusColor, getStatusIcon } from "@/shared/lib/status-utils";
import { SeverityBorderIcon, UISeverity } from "@/shared/ui";
import {
  countReplacedNotes,
  formatAlertCount,
  groupByFromStatus,
  mayResolveIncident,
} from "../lib/status-change-draft";

function StatusPill({ status }: { status: string | null }) {
  const name = status ?? "unknown";
  return (
    <Badge
      size="xs"
      color={getStatusColor(name)}
      icon={getStatusIcon(name)}
      className="capitalize"
    >
      {name}
    </Badge>
  );
}

// Names come from outside: isolated, so that text with another direction
// cannot rearrange what is around it
function AlertRow({ alert }: { alert: DraftAlert }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      {alert.severity && (
        <SeverityBorderIcon severity={alert.severity as UISeverity} />
      )}
      <bdi className="min-w-0 flex-1 truncate" title={alert.fingerprint}>
        {alert.name ?? alert.fingerprint}
      </bdi>
      {alert.severity && (
        <span className="shrink-0 capitalize text-gray-500">
          {alert.severity}
        </span>
      )}
    </li>
  );
}

function FingerprintLine({
  label,
  fingerprints,
}: {
  label: string;
  fingerprints: string[];
}) {
  if (fingerprints.length === 0) {
    return null;
  }
  return (
    <p className="break-words text-gray-500">
      {fingerprints.length} {label}:{" "}
      <bdi className="break-all">{fingerprints.join(", ")}</bdi>
    </p>
  );
}

/** What a status-change draft would do, in full. */
export function StatusChangeDraftBody({
  payload,
}: {
  payload: ChangeAlertStatusPayload;
}) {
  const replacedNotes = countReplacedNotes(payload);

  return (
    <div className="flex flex-col gap-2 text-xs text-gray-700">
      <ul className="flex flex-col gap-1" aria-label="Status changes">
        {groupByFromStatus(payload.alerts).map(({ status, count }) => (
          <li
            key={String(status)}
            className="flex flex-wrap items-center gap-1"
          >
            <StatusPill status={status} />
            <ArrowRightIcon
              className="h-3 w-3 shrink-0 text-gray-400"
              role="img"
              aria-label="to"
            />
            <StatusPill status={payload.target_status} />
            <span className="text-gray-500">{formatAlertCount(count)}</span>
          </li>
        ))}
      </ul>

      <ul
        // Scrolls with the keyboard too
        tabIndex={0}
        aria-label="Alerts"
        className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded border border-gray-200 bg-white p-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-400"
      >
        {payload.alerts.map((alert) => (
          <AlertRow key={alert.fingerprint} alert={alert} />
        ))}
      </ul>

      {payload.skipped.length > 0 && (
        <p className="text-gray-500">
          {payload.skipped.length} already {payload.target_status}, skipped
        </p>
      )}
      <FingerprintLine label="not found" fingerprints={payload.not_found} />
      <FingerprintLine
        label="could not be looked up"
        fingerprints={payload.unresolvable}
      />

      {payload.note && (
        <div>
          <p className="font-medium">Note</p>
          <p className="whitespace-pre-wrap break-words" dir="auto">
            {payload.note}
          </p>
        </div>
      )}
      {replacedNotes > 0 && (
        <p className="text-amber-700">
          Replaces the note on {formatAlertCount(replacedNotes)}
        </p>
      )}
      <p className="text-gray-500">
        {payload.dispose_on_new_alert
          ? "Disposes the status when a new alert comes in"
          : "Keeps the status when a new alert comes in"}
      </p>
      {mayResolveIncident(payload) && (
        <p className="text-amber-700">
          Some of these alerts belong to an incident, which may be resolved too
        </p>
      )}
    </div>
  );
}
