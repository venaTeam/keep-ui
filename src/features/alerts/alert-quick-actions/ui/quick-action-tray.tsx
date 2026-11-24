import { MouseEvent, Ref } from "react";
import clsx from "clsx";
import { AlertDto } from "@/entities/alerts/model/types";
import { ALERT_QUICK_ACTIONS } from "../model/actions";
import { getPointerOpener } from "../model/pointer-opener";
import { OpenQuickActionHandler } from "../model/types";
import { QUICK_TRAY_CLASS } from "./class-names";

interface QuickActionTrayProps {
  alert: AlertDto;
  compact?: boolean;
  onOpen: OpenQuickActionHandler;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A widget row's floating tray of the quick actions that apply to its alert;
 * `compact` shows icons only. It hangs from the bottom edge of its positioned
 * anchor at the anchor's right end, or from its top edge when the tray
 * carries `data-placement="above"`.
 */
export function QuickActionTray({
  alert,
  compact = false,
  onOpen,
  ref,
}: QuickActionTrayProps) {
  return (
    <div
      ref={ref}
      className={clsx(
        QUICK_TRAY_CLASS,
        "absolute right-1 top-full z-20 flex gap-0.5 rounded-md border bg-white p-0.5 shadow-sm",
        "data-[placement=above]:top-auto data-[placement=above]:bottom-full"
      )}
    >
      {ALERT_QUICK_ACTIONS.filter((action) => action.appliesTo(alert)).map(
        (action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              aria-label={`${action.label}: ${alert.name}`}
              title={compact ? action.label : undefined}
              data-cy={`widget-quick-action-${action.id}`}
              className={clsx(
                "flex items-center gap-1 whitespace-nowrap rounded text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-400",
                compact ? "p-1" : "px-1.5 py-0.5"
              )}
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                onOpen(action.id, [alert], getPointerOpener(event));
              }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {!compact && action.label}
            </button>
          );
        }
      )}
    </div>
  );
}
