import { AlertDto } from "@/entities/alerts/model/types";
import { Status as IncidentStatus } from "@/entities/incidents/model";

/** True when the alert links to an incident that is neither a candidate nor deleted; `is_visible` is not on `IncidentDto`, so a hidden incident still counts as live. */
export function hasLiveIncident(alert: AlertDto): boolean {
  return (alert.incident_dto ?? []).some(
    (incident) =>
      incident.is_candidate !== true &&
      incident.status !== IncidentStatus.Deleted
  );
}
