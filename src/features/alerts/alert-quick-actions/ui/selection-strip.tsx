import clsx from "clsx";
import { AlertDto } from "@/entities/alerts/model/types";
import { ALERT_QUICK_ACTIONS } from "../model/actions";
import { getPointerOpener } from "../model/pointer-opener";
import { getEligibleAlerts, getStripLabel } from "../model/selection";
import { OpenQuickActionHandler } from "../model/types";

interface SelectionStripProps {
  alerts: AlertDto[];
  onOpen: OpenQuickActionHandler;
  onClear: () => void;
}

const STRIP_BUTTON_CLASSES =
  "flex items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 text-gray-700 hover:bg-orange-100 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-400";

/** Stands in for the widget's count line while alerts are ticked: the count, each bulk action that applies to any of them, and Clear. */
export function SelectionStrip({
  alerts,
  onOpen,
  onClear,
}: SelectionStripProps) {
  const entries = ALERT_QUICK_ACTIONS.filter((action) => action.bulk)
    .map((action) => ({ action, eligible: getEligibleAlerts(action, alerts) }))
    .filter(({ eligible }) => eligible.length > 0);

  return (
    <div
      data-cy="widget-selection-strip"
      className="flex flex-wrap items-center gap-x-1.5 min-h-6 rounded border border-orange-200 bg-orange-50 px-2 text-xs"
    >
      <span className="font-medium text-gray-700">
        {alerts.length} selected
      </span>
      <span aria-hidden="true" className="h-3.5 w-px bg-orange-200" />
      {entries.map(({ action, eligible }) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            data-cy={`widget-selection-action-${action.id}`}
            className={STRIP_BUTTON_CLASSES}
            onClick={(event) =>
              onOpen(action.id, eligible, getPointerOpener(event))
            }
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {getStripLabel(action, eligible.length, alerts.length)}
          </button>
        );
      })}
      <button
        type="button"
        data-cy="widget-selection-clear"
        className={clsx("ml-auto", STRIP_BUTTON_CLASSES)}
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  );
}
