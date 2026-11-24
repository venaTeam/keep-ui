import { ChangeEvent, useContext, useState } from "react";
import clsx from "clsx";
import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import type { AlertDto } from "@/entities/alerts/model/types";
import { TableIndeterminateCheckbox } from "@/shared/ui";
import {
  QUICK_OPEN_ATTR,
  QUICK_PICK_CLASS,
  QUICK_REVEAL_CLASS,
  QuickActionTray,
} from "@/features/alerts/alert-quick-actions";
import { isLinkIconColumn } from "@/widgets/alerts-table/lib/alert-link-columns";
import { WidgetRowActionsContext } from "./widget-row-actions-context";
import { TRAY_GAP_PX, useTrayDock } from "./widget-tray-dock";

/** Id of the widget's checkbox gutter column. */
export const CHECKBOX_COLUMN_ID = "checkbox";

/** Id of the widget's row-actions column, the presets page's ⋯ column id. */
export const ROW_ACTIONS_COLUMN_ID = "alertMenu";

/** Width of the checkbox gutter, in pixels. */
export const CHECKBOX_COLUMN_PX = 28;

/**
 * Total width, in pixels, of the contiguous run of visible link icon columns
 * (Rule, Runbook) that ends the row just before the row-actions column; 0 when
 * the last visible column is not one.
 */
export function getTrailingLinkColumnsPx<T>(table: Table<T>): number {
  const columns = table
    .getVisibleLeafColumns()
    .filter((column) => column.id !== ROW_ACTIONS_COLUMN_ID);
  let width = 0;
  for (let index = columns.length - 1; index >= 0; index -= 1) {
    if (!isLinkIconColumn(columns[index].id)) {
      break;
    }
    width += columns[index].getSize();
  }
  return width;
}

/** A row's selection checkbox, plus a marker while that row's dialog is open. */
function RowCheckbox({ row }: { row: Row<AlertDto> }) {
  const actions = useContext(WidgetRowActionsContext);
  if (!actions) {
    return null;
  }
  return (
    <div className="flex items-center justify-center">
      <input
        type="checkbox"
        className={clsx(QUICK_REVEAL_CLASS, QUICK_PICK_CLASS, "cursor-pointer")}
        aria-label={`Select ${row.original.name}`}
        data-cy="widget-row-checkbox"
        checked={row.getIsSelected()}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          actions.onPick(
            row.id,
            (event.nativeEvent as MouseEvent).shiftKey === true
          )
        }
      />
      {actions.openFingerprint === row.original.fingerprint && (
        <span {...{ [QUICK_OPEN_ATTR]: "" }} hidden />
      )}
    </div>
  );
}

/**
 * A row's quick-action tray, hidden while anything is ticked. Over trailing
 * link icon columns it floats left of them, and slides over them, compact
 * when its full labels would not fit there, while the pointer reads cells it
 * would cover (`useTrayDock`).
 */
function RowActions({
  alert,
  table,
}: {
  alert: AlertDto;
  table: Table<AlertDto>;
}) {
  const actions = useContext(WidgetRowActionsContext);
  const [tray, setTray] = useState<HTMLDivElement | null>(null);
  const linkColumnsPx = getTrailingLinkColumnsPx(table);
  const placement = useTrayDock(tray, linkColumnsPx);
  if (!actions || actions.isSelecting) {
    return null;
  }
  return (
    <QuickActionTray
      ref={setTray}
      alert={alert}
      compact={actions.compact || (linkColumnsPx > 0 && placement.compact)}
      onOpen={actions.onOpenAction}
      rightOffsetPx={
        linkColumnsPx > 0 && placement.dock === "left"
          ? linkColumnsPx + TRAY_GAP_PX
          : undefined
      }
      instantPlacement={linkColumnsPx > 0 && placement.instant}
    />
  );
}

/**
 * The Alert Table widget's selection chrome columns: a 28 px checkbox gutter
 * with a select-all-shown header, and a zero-width row-actions column whose
 * tray floats over the row's last cells, left of any trailing link icon
 * columns. They read `WidgetRowActionsContext`
 * and are never part of the widget's saved columns.
 */
export const QUICK_ACTION_COLUMNS: {
  checkbox: ColumnDef<AlertDto>;
  rowActions: ColumnDef<AlertDto>;
} = {
  checkbox: {
    id: CHECKBOX_COLUMN_ID,
    size: CHECKBOX_COLUMN_PX,
    minSize: CHECKBOX_COLUMN_PX,
    maxSize: CHECKBOX_COLUMN_PX,
    header: ({ table }) => (
      <TableIndeterminateCheckbox
        className={QUICK_REVEAL_CLASS}
        aria-label="Select all shown alerts"
        data-cy="widget-select-all"
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => <RowCheckbox row={row} />,
    meta: { tdClassName: "!p-0 !w-7", thClassName: "!p-0 !w-7" },
  },
  rowActions: {
    id: ROW_ACTIONS_COLUMN_ID,
    size: 0,
    minSize: 0,
    maxSize: 0,
    header: () => null,
    cell: ({ row, table }) => <RowActions alert={row.original} table={table} />,
    meta: {
      tdClassName: "!p-0 !w-0 overflow-visible",
      thClassName: "!p-0 !w-0",
    },
  },
};
