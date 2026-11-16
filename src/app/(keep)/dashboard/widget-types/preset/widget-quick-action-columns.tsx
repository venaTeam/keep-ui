import { ChangeEvent, useContext } from "react";
import clsx from "clsx";
import type { ColumnDef, Row, TableFeature } from "@tanstack/react-table";
import type { AlertDto } from "@/entities/alerts/model/types";
import { TableIndeterminateCheckbox } from "@/shared/ui";
import {
  QUICK_OPEN_ATTR,
  QUICK_PICK_CLASS,
  QUICK_REVEAL_CLASS,
  QuickActionTray,
} from "@/features/alerts/alert-quick-actions";
import { WidgetRowActionsContext } from "./widget-row-actions-context";

/** Id of the widget's checkbox gutter column. */
export const CHECKBOX_COLUMN_ID = "checkbox";

/** Id of the widget's row-actions column, the presets page's ⋯ column id. */
export const ROW_ACTIONS_COLUMN_ID = "alertMenu";

/** Width of the checkbox gutter, in pixels. */
export const CHECKBOX_COLUMN_PX = 28;

/**
 * A table feature that makes a group row's selection handler tick or untick
 * every selectable row under it, the group row itself never entering the
 * selection. The widget makes group rows unselectable, and TanStack's own
 * handler does nothing for a row that cannot be selected, so without it the
 * shared group header checkbox would do nothing.
 */
export const GROUP_ROW_SELECTION: TableFeature<AlertDto> = {
  createRow: (row, table) => {
    const getOwnHandler = row.getToggleSelectedHandler;
    row.getToggleSelectedHandler = () => {
      if (!row.getIsGrouped()) {
        return getOwnHandler();
      }
      return (event: unknown) => {
        const tick = (event as ChangeEvent<HTMLInputElement>).target.checked;
        const ids = row
          .getLeafRows()
          .filter((leaf) => leaf.getCanSelect())
          .map((leaf) => leaf.id);
        table.setRowSelection((old) => {
          const next = { ...old };
          ids.forEach((id) => {
            if (tick) {
              next[id] = true;
            } else {
              delete next[id];
            }
          });
          return next;
        });
      };
    };
  },
};

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

/** A row's quick-action tray, hidden while anything is ticked. */
function RowActions({ alert }: { alert: AlertDto }) {
  const actions = useContext(WidgetRowActionsContext);
  if (!actions || actions.isSelecting) {
    return null;
  }
  return (
    <QuickActionTray
      alert={alert}
      compact={actions.compact}
      onOpen={actions.onOpenAction}
    />
  );
}

/**
 * The Alert Table widget's selection chrome columns: a 28 px checkbox gutter
 * with a select-all-shown header, and a zero-width row-actions column whose
 * tray floats over the row's last cells. They read `WidgetRowActionsContext`
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
    cell: ({ row }) => <RowActions alert={row.original} />,
    meta: {
      tdClassName: "!p-0 !w-0 overflow-visible",
      thClassName: "!p-0 !w-0",
    },
  },
};
