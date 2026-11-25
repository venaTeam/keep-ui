import { TableRow, TableCell } from "@tremor/react";
import { AlertDto } from "@/entities/alerts/model";
import { Table, flexRender, Row } from "@tanstack/react-table";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import Link from "next/link";
import { startCase } from "lodash";
import { Fragment, useEffect } from "react";
import { getCommonPinningStylesAndClassNames } from "@/shared/ui";
import { RowStyle } from "@/entities/alerts/model/useAlertRowStyle";
import {
  getRowClassName,
  getCellClassName,
} from "@/widgets/alerts-table/lib/alert-table-utils";
import { isEmptyGroupValue } from "@/widgets/alerts-table/lib/group-values";
import {
  RowAppearance,
  applyRowAppearance,
} from "@/widgets/alerts-table/lib/row-appearance";
import { TableIndeterminateCheckbox } from "@/shared/ui";
import { useRingingRows } from "@/widgets/alerts-table/lib/alert-ringing";

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
  showIncidentDetails?: boolean;
  linksDisabled?: boolean;
  getColumnLabel?: (columnId: string) => string;
  rowAppearance?: RowAppearance;
  selectable?: boolean;
  presetNoisy?: boolean;
  /** Extra class names for the group header's selection checkbox. */
  checkboxClassName?: string;
}

interface IncidentGroupDetailsProps {
  incidents: any[];
  shownCount: number;
  linksDisabled: boolean;
}

const IncidentGroupDetails = ({
  incidents,
  shownCount,
  linksDisabled,
}: IncidentGroupDetailsProps) => {
  const isSingleIncident = incidents.length === 1;

  return (
    <>
      <span className="font-medium">
        {incidents.map((incident, index) => {
          const name =
            incident.user_generated_name || incident.ai_generated_name;
          return (
            <Fragment key={incident.id}>
              {index > 0 && ", "}
              {linksDisabled ? (
                name
              ) : (
                <Link
                  href={`/incidents/${incident.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-orange-700 underline underline-offset-2 hover:text-orange-900"
                >
                  {name}
                </Link>
              )}
            </Fragment>
          );
        })}
      </span>
      {isSingleIncident && (
        <span className="rounded-full bg-gray-200 px-2 text-[10px] font-semibold capitalize text-gray-700">
          {incidents[0].status}
        </span>
      )}
      <span className="text-gray-500 text-sm">
        {isSingleIncident
          ? `${shownCount} shown · ${incidents[0].alerts_count} in incident`
          : `${shownCount} shown · in ${incidents.length} incidents`}
      </span>
    </>
  );
};

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
  showIncidentDetails = false,
  linksDisabled = false,
  getColumnLabel,
  rowAppearance = "default",
  selectable = true,
  presetNoisy = false,
  checkboxClassName,
}: GroupedRowProps) => {
  const groupKey = row.id;
  const ringingRow = useRingingRows(presetNoisy);

  // Initialize the group when component mounts
  useEffect(() => {
    if (onGroupInitialized && row.getIsGrouped()) {
      onGroupInitialized(groupKey);
    }
  }, [groupKey, onGroupInitialized, row]);

  if (row.getIsGrouped()) {
    const groupingColumnId = row.groupingColumnId;
    const isIncidentGroup = groupingColumnId === "incident";
    const isEmptyGroup =
      !!groupingColumnId && isEmptyGroupValue(row.groupingValue);
    const incidentsDto = row.original.incident_dto;
    const showIncidentLinks =
      showIncidentDetails && isIncidentGroup && !isEmptyGroup;
    const isPlainEmptyIncidentGroup =
      showIncidentDetails && isIncidentGroup && isEmptyGroup;

    let groupValue = groupingColumnId
      ? row.getValue(groupingColumnId)
      : "Unknown Group";

    if (groupingColumnId && isEmptyGroup) {
      if (isIncidentGroup) {
        groupValue = showIncidentDetails ? "No incident" : "No Incidents";
      } else {
        groupValue = `No ${getColumnLabel?.(groupingColumnId) ?? startCase(groupingColumnId)}`;
      }
    } else if (isIncidentGroup) {
      groupValue = incidentsDto
        ?.map((incident) => {
          return incident.user_generated_name || incident.ai_generated_name;
        })
        .join(", ");
    }

    const headerRinging = ringingRow(
      isExpanded ? [] : row.subRows.map((subRow) => subRow.original)
    );
    const headerRingingCell = headerRinging.cellProps(0, 1);

    return (
      <>
        {/* Group Header Row */}
        <TableRow
          className={
            isPlainEmptyIncidentGroup
              ? "bg-white hover:bg-gray-50 cursor-pointer border-t border-gray-200"
              : "bg-orange-100 hover:bg-orange-200 cursor-pointer border-t border-orange-300"
          }
          onClick={() => onToggleExpanded?.(groupKey)}
          data-cy="alerts-group-header"
          data-cy-id={groupKey}
          {...headerRinging.rowProps}
        >
          {/* Render a single cell that spans the entire width */}
          <TableCell
            ref={headerRingingCell.ref}
            colSpan={row.getVisibleCells().length}
            className={clsx(
              isPlainEmptyIncidentGroup
                ? "group-header-cell bg-white border-l-[3px] border-l-gray-400 group-hover:bg-gray-50"
                : "group-header-cell bg-orange-100 group-hover:bg-orange-200",
              headerRingingCell.className
            )}
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
              {selectable &&
                row.getVisibleCells().some((c) => c.column.id === "checkbox") && (
                <TableIndeterminateCheckbox
                  checked={row.getIsAllSubRowsSelected()}
                  indeterminate={row.getIsSomeSelected()}
                  onChange={row.getToggleSelectedHandler()}
                  onClick={(e) => e.stopPropagation()}
                  className={checkboxClassName}
                />
              )}
              <div className="flex items-center gap-2 flex-grow">
                {showIncidentLinks && incidentsDto?.length ? (
                  <IncidentGroupDetails
                    incidents={incidentsDto}
                    shownCount={row.subRows.length}
                    linksDisabled={linksDisabled}
                  />
                ) : showIncidentDetails ? (
                  <>
                    <span
                      className={clsx(
                        "font-medium",
                        isPlainEmptyIncidentGroup && "italic text-gray-700"
                      )}
                    >
                      {String(groupValue)}
                    </span>{" "}
                    <span className="text-gray-500 text-sm">
                      {isPlainEmptyIncidentGroup
                        ? `· ${row.subRows.length} shown`
                        : `${row.subRows.length} shown`}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">{String(groupValue)}</span>
                    <span className="text-gray-500 text-sm">
                      ({row.subRows.length}{" "}
                      {row.subRows.length === 1 ? "alert" : "alerts"})
                    </span>
                  </>
                )}
              </div>
            </div>
            {headerRinging.reason}
          </TableCell>
        </TableRow>

        {/* Child Rows */}
        {isExpanded &&
          row.subRows.map((subRow) => {
            const isLastViewed =
              subRow.original.fingerprint === lastViewedAlert;
            const ringing = ringingRow(subRow.original);

            return (
              <TableRow
                key={subRow.id}
                className={applyRowAppearance(
                  getRowClassName(subRow, theme, lastViewedAlert, rowStyle),
                  rowAppearance
                )}
                onClick={(e) => onRowClick?.(e, subRow.original)}
                data-cy="alerts-row"
                data-cy-id={subRow.original.fingerprint}
                {...ringing.rowProps}
              >
                {subRow.getVisibleCells().map((cell, cellIndex, cells) => {
                  const { style, className } =
                    getCommonPinningStylesAndClassNames(cell.column);
                  const ringingCell = ringing.cellProps(
                    cellIndex,
                    cells.length
                  );

                  return (
                    <TableCell
                      key={cell.id}
                      ref={ringingCell.ref}
                      data-column-id={cell.column.id}
                      className={clsx(
                        applyRowAppearance(
                          getCellClassName(
                            cell,
                            className,
                            rowStyle,
                            isLastViewed
                          ),
                          rowAppearance
                        ),
                        ringingCell.className
                      )}
                      style={style}
                      data-cy={`alerts-cell-${cell.column.id}`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                      {cellIndex === 0 && ringing.reason}
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

  return (
    <TableRow
      id={`alert-row-${row.original.fingerprint}`}
      key={row.id}
      className={applyRowAppearance(
        getRowClassName(row, theme, lastViewedAlert, rowStyle),
        rowAppearance
      )}
      onClick={(e) => onRowClick?.(e, row.original)}
      data-cy="alerts-row"
      data-cy-id={row.original.fingerprint}
    >
      {row.getVisibleCells().map((cell) => {
        const { style, className } =
          getCommonPinningStylesAndClassNames(cell.column);

        return (
          <TableCell
            key={cell.id}
            data-column-id={cell.column.id}
            className={applyRowAppearance(
              getCellClassName(cell, className, rowStyle, isLastViewed),
              rowAppearance
            )}
            style={style}
            data-cy={`alerts-cell-${cell.column.id}`}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
  );
};
