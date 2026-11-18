import { ChevronDoubleRightIcon, LinkIcon } from "@heroicons/react/24/outline";
import { IoNotificationsOffOutline } from "react-icons/io5";
import { Status } from "@/entities/alerts/model/types";
import {
  ChangeStatusDialog,
  DismissDialog,
  LinkIncidentDialog,
} from "../ui/action-dialogs";
import { WidgetAlertAction } from "./types";

/** The Alert Table widget's quick actions, in screen order. */
export const ALERT_QUICK_ACTIONS: readonly WidgetAlertAction[] = [
  {
    id: "change-status",
    label: "Change Status",
    partialLabel: () => "Change Status",
    icon: ChevronDoubleRightIcon,
    appliesTo: () => true,
    bulk: true,
    Dialog: ChangeStatusDialog,
  },
  {
    id: "link-incident",
    label: "Link to incident",
    partialLabel: () => "Link to incident",
    icon: LinkIcon,
    appliesTo: () => true,
    bulk: true,
    Dialog: LinkIncidentDialog,
  },
  {
    id: "dismiss",
    label: "Dismiss",
    partialLabel: (count) => `Dismiss ${count}`,
    icon: IoNotificationsOffOutline,
    appliesTo: (alert) => alert.status !== Status.Suppressed,
    bulk: true,
    Dialog: DismissDialog,
  },
];

/** The quick action with the given id, or undefined when there is none. */
export function getQuickAction(id: string): WidgetAlertAction | undefined {
  return ALERT_QUICK_ACTIONS.find((action) => action.id === id);
}
