import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AlertDto } from "@/entities/alerts/model/types";
import { useAlertTableCols } from "@/widgets/alerts-table/lib/alert-table-utils";
import { getAdditionalColsToGenerate } from "@/widgets/alerts-table/lib/additional-cols";
import { getColumnLabel } from "@/widgets/alerts-table/lib/alert-column-options";
import type { WidgetData } from "../../types";
import {
  WIDGET_COLUMN_MIN_SIZE,
  WIDGET_EXCLUDED_COLUMNS,
  WIDGET_PINNED_LEFT,
  WIDGET_STATIC_COLUMN_IDS,
  getGroupByColumnId,
  getKnownColumnIds,
  getVisibleColumnIds,
} from "./alert-table-widget-config";
import { normalizeEmptyGrouping } from "./empty-group-row-model";

const STATIC_COLUMN_IDS: ReadonlySet<string> = new Set(
  WIDGET_STATIC_COLUMN_IDS
);
const NO_ALERTS: AlertDto[] = [];

function useStableIds(ids: string[]): string[] {
  const key = JSON.stringify(ids);
  return useMemo(() => JSON.parse(key) as string[], [key]);
}

function getFieldKeys(alerts: AlertDto[]): string[] {
  return Array.from(new Set(alerts.flatMap(Object.keys))).sort();
}

function isShownInWidget(column: ColumnDef<AlertDto>): boolean {
  return !WIDGET_EXCLUDED_COLUMNS.includes(column.id as string);
}

function atMinimumSize(column: ColumnDef<AlertDto>): ColumnDef<AlertDto> {
  const minSize =
    WIDGET_COLUMN_MIN_SIZE.get(column.id as string) ?? column.minSize;
  return minSize === undefined ? column : { ...column, minSize, size: minSize };
}

/**
 * Builds the column definitions of an Alert Table widget.
 *
 * Besides the fixed columns it generates one for every field of the loaded
 * alerts (a list field is one column, not one per item), every visible
 * column, the group-by field and `incident`, so a configured column nobody
 * has still renders (empty). A saved snake_case id resolves to its camelCase
 * form when that is a fixed column, a known alert key or a field of the
 * loaded alerts; the group-by field resolves the same way. The checkbox, menu
 * and noise columns are left out. Empty grouping values share one group, and
 * every column except the icon columns is headed by its widget label, so no
 * stored presets-page name can show through. Those columns also start at
 * their minimum width (`WIDGET_COLUMN_MIN_SIZE` for name and description), so
 * a full-width table spreads the spare room over them; a width saved on the
 * widget wins. `presetName` scopes the browser keys the shared column hook
 * reads, so pass a widget-scoped name.
 */
export function useWidgetAlertColumns({
  item,
  alerts,
  presetName,
}: {
  item: WidgetData;
  alerts?: AlertDto[];
  presetName: string;
}): { columns: ColumnDef<AlertDto>[]; allColumnIds: string[] } {
  const alertKeys = useStableIds(
    getAdditionalColsToGenerate(alerts ?? NO_ALERTS, { arraysAsLeaves: true })
  );
  const fieldKeys = useStableIds(getFieldKeys(alerts ?? NO_ALERTS));
  const knownIds = useMemo(
    () => getKnownColumnIds([...alertKeys, ...fieldKeys]),
    [alertKeys, fieldKeys]
  );
  const groupBy = getGroupByColumnId(item, knownIds);
  const additionalColsToGenerate = useStableIds(
    Array.from(
      new Set([
        ...alertKeys,
        ...getVisibleColumnIds(item, knownIds),
        ...(groupBy ? [groupBy] : []),
        "incident",
      ])
    ).filter(
      (id) => !STATIC_COLUMN_IDS.has(id) && !WIDGET_EXCLUDED_COLUMNS.includes(id)
    )
  );

  const tableColumns = useAlertTableCols({
    additionalColsToGenerate,
    isCheckboxDisplayed: false,
    isMenuDisplayed: false,
    presetName,
  });

  const renames = item.alertTable?.columnRenameMapping;
  const columns = useMemo(
    () =>
      normalizeEmptyGrouping(tableColumns.filter(isShownInWidget)).map(
        (column) =>
          WIDGET_PINNED_LEFT.includes(column.id as string)
            ? column
            : {
                ...atMinimumSize(column),
                header: getColumnLabel(column.id as string, renames),
              }
      ),
    [tableColumns, renames]
  );
  const allColumnIds = useMemo(
    () =>
      tableColumns.filter(isShownInWidget).map((column) => column.id as string),
    [tableColumns]
  );

  return { columns, allColumnIds };
}
