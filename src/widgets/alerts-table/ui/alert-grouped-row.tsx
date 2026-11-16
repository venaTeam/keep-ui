import { TableRow, TableCell } from "@tremor/react";
import { AlertDto } from "@/entities/alerts/model";
import { Table, flexRender, Row } from "@tanstack/react-table";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useEffect } from "react";
import { getCommonPinningStylesAndClassNames } from "@/shared/ui";
import { RowStyle } from "@/entities/alerts/model/useAlertRowStyle";
import {
  getRowClassName,
  getCellClassName,
} from "@/widgets/alerts-table/lib/alert-table-utils";
import { TableIndeterminateCheckbox } from "@/shared/ui";
import { useSyncedAnimation } from "@/shared/lib/hooks/useSyncedAnimation";
import {
  RINGING_CELL_CLASS_NAME,
  RingingReason,
  getRingingProps,
  isAlertRinging,
} from "@/widgets/alerts-table/lib/alert-ringing";

interface GroupedRowProps {
  row: Row<AlertDto>;
  table: Table<AlertDto>;
  theme: Record<string, string>;
  onRowClick?: (e: React.MouseEvent, alert: AlertDto) => void;
  lastViewedAlert: string | null;
  rowStyle: RowStyle;
  isExpanded?: boolean;
  onToggleExpanded?: (groupKey: string) => void;
  onGroupInitialized?: (groupKey: string) => void;
  presetNoisy?: boolean;
}

export const GroupedRow = ({
  row,
  table,
  theme,
  onRowClick,
  lastViewedAlert,
  rowStyle,
  isExpanded = true,
  onToggleExpanded,
  onGroupInitialized,
  presetNoisy = false,
}: GroupedRowProps) => {
  const groupKey = row.id;
  const syncBlink = useSyncedAnimation(presetNoisy);

  // Initialize the group when component mounts
  useEffect(() => {
    if (onGroupInitialized && row.getIsGrouped()) {
      onGroupInitialized(groupKey);
    }
  }, [groupKey, onGroupInitialized, row]);

  if (row.getIsGrouped()) {
    const groupingColumnId = row.groupingColumnId;

    let groupValue = groupingColumnId
      ? row.getValue(groupingColumnId)
      : "Unknown Group";

    if (groupingColumnId === "incident") {
      const incidentsDto = row.original.incident_dto;
      const incidentIds = row.getValue(groupingColumnId);
      if (!incidentIds || incidentIds === "undefined") {
        groupValue = "No Incidents";
      } else {
        groupValue = incidentsDto
          ?.map((incident) => {
            return incident.user_generated_name || incident.ai_generated_name;
          })
          .join(", ");
      }
    }

    return (
      <>
        {/* Group Header Row */}
        <TableRow
          className="bg-orange-100 hover:bg-orange-200 cursor-pointer border-t border-orange-300"
          onClick={() => onToggleExpanded?.(groupKey)}
          data-cy="alerts-group-header"
          data-cy-id={groupKey}
        >
          {/* Render a single cell that spans the entire width */}
          <TableCell
            colSpan={row.getVisibleCells().length}
            className="group-header-cell bg-orange-100 group-hover:bg-orange-200"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <ChevronDownIcon
                  className={clsx(
                    "w-5 h-5 transition-transform",
                    !isExpanded && "-rotate-90"
                  )}
                />
              </div>
              {row.getVisibleCells().some((c) => c.column.id === "checkbox") && (
                <TableIndeterminateCheckbox
                  checked={row.getIsAllSubRowsSelected()}
                  indeterminate={row.getIsSomeSelected()}
                  onChange={row.getToggleSelectedHandler()}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <div className="flex items-center gap-2 flex-grow">
                <span className="font-medium">{String(groupValue)}</span>
                <span className="text-gray-500 text-sm">
                  ({row.subRows.length}{" "}
                  {row.subRows.length === 1 ? "alert" : "alerts"})
                </span>
              </div>
            </div>
          </TableCell>
        </TableRow>

        {/* Child Rows */}
        {isExpanded &&
          row.subRows.map((subRow) => {
            const isLastViewed =
              subRow.original.fingerprint === lastViewedAlert;
            const ringing = isAlertRinging(subRow.original, presetNoisy);
            const ringingProps = getRingingProps(ringing);

            return (
              <TableRow
                key={subRow.id}
                ref={ringing ? syncBlink : undefined}
                className={clsx(
                  getRowClassName(subRow, theme, lastViewedAlert, rowStyle),
                  ringingProps.className
                )}
                style={ringingProps.style}
                onClick={(e) => onRowClick?.(e, subRow.original)}
                data-cy="alerts-row"
                data-cy-id={subRow.original.fingerprint}
                data-ringing={ringingProps["data-ringing"]}
              >
                {subRow.getVisibleCells().map((cell, cellIndex) => {
                  const { style, className } =
                    getCommonPinningStylesAndClassNames(cell.column);

                  return (
                    <TableCell
                      key={cell.id}
                      className={clsx(
                        getCellClassName(
                          cell,
                          className,
                          rowStyle,
                          isLastViewed
                        ),
                        ringing && RINGING_CELL_CLASS_NAME
                      )}
                      style={style}
                      data-cy={`alerts-cell-${cell.column.id}`}
                    >
                      {ringing && cellIndex === 0 && <RingingReason />}
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
      </>
    );
  }

  // Regular non-grouped row
  const isLastViewed = row.original.fingerprint === lastViewedAlert;
  const ringing = isAlertRinging(row.original, presetNoisy);
  const ringingProps = getRingingProps(ringing);

  return (
    <TableRow
      id={`alert-row-${row.original.fingerprint}`}
      key={row.id}
      ref={ringing ? syncBlink : undefined}
      className={clsx(
        getRowClassName(row, theme, lastViewedAlert, rowStyle),
        ringingProps.className
      )}
      style={ringingProps.style}
      onClick={(e) => onRowClick?.(e, row.original)}
      data-cy="alerts-row"
      data-cy-id={row.original.fingerprint}
      data-ringing={ringingProps["data-ringing"]}
    >
      {row.getVisibleCells().map((cell, cellIndex) => {
        const { style, className } =
          getCommonPinningStylesAndClassNames(cell.column);

        return (
          <TableCell
            key={cell.id}
            className={clsx(
              getCellClassName(cell, className, rowStyle, isLastViewed),
              ringing && RINGING_CELL_CLASS_NAME
            )}
            style={style}
            data-cy={`alerts-cell-${cell.column.id}`}
          >
            {ringing && cellIndex === 0 && <RingingReason />}
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
  );
};
