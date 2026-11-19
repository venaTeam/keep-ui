import { format } from "date-fns";
import { IncidentDto } from "@/entities/incidents/model";
// Straight from models, not the model index: server components import this
// file, and the index also exports React hooks.
import { Status } from "@/entities/incidents/model/models";
import { parseDeadline } from "./dismissal-deadline";
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/20/solid";

export function getIncidentName(incident: IncidentDto) {
  return (
    incident.user_generated_name || incident.ai_generated_name || incident.id
  );
}

export function getIncidentNameWithCreationTime(incident: IncidentDto) {
  return `${incident.user_generated_name || incident.ai_generated_name || incident.id} (${incident.creation_time})`;
}

/**
 * "suppressed" or "suppressed until <time>" for a suppressed incident, else null.
 * Linking an alert to a suppressed incident suppresses the alert too, so places
 * that offer incidents to link to show it.
 */
export function getIncidentSuppressionLabel(incident: IncidentDto) {
  if (incident.status !== Status.Suppressed) {
    return null;
  }
  if (incident.dismiss_mode === "dismiss_until" && incident.dismissed_until) {
    const deadline = parseDeadline(incident.dismissed_until);
    if (!Number.isNaN(deadline)) {
      return `suppressed until ${format(deadline, "MMM d, yyyy HH:mm")}`;
    }
  }
  return "suppressed";
}

export function getIncidentSeverityIconAndColor(
  severity: IncidentDto["severity"]
) {
  let icon: any;
  let color: any;

  switch (severity) {
    case "critical":
      icon = ExclamationCircleIcon;
      color = "red";
      break;
    case "high":
      icon = ExclamationTriangleIcon;
      color = "orange";
      break;
    case "warning":
      color = "yellow";
      icon = ExclamationTriangleIcon;
      break;
    case "info":
      icon = InformationCircleIcon;
      color = "green";
      break;
    case "low":
      icon = InformationCircleIcon;
      color = "blue";
      break;
    default:
      icon = InformationCircleIcon;
      color = "blue";
      break;
  }
  return { icon, color };
}
