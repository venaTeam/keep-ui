import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AlertDto } from "@/entities/alerts/model/types";
import { useAlertTableCols } from "@/widgets/alerts-table/lib/alert-table-utils";
import { getAdditionalColsToGenerate } from "@/widgets/alerts-table/lib/additional-cols";
import { getColumnLabel } from "@/widgets/alerts-table/lib/alert-column-options";
import type { WidgetData } from "../../types";
import {
  WIDGET_EXCLUDED_COLUMNS,
  WIDGET_PINNED_LEFT,
  WIDGET_STATIC_COLUMN_IDS,
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

function isShownInWidget(column: ColumnDef<AlertDto>): boolean {
  return !WIDGET_EXCLUDED_COLUMNS.includes(column.id as string);
}

/**
 * Builds the column definitions of an Alert Table widget.
 *
 * Besides the fixed columns it generates one for every field of the loaded
 * alerts, every visible column, the group-by field and `incident`, so a
 * configured column nobody has still renders (empty). The checkbox, menu and
 * noise columns are left out. Empty grouping values share one group, and every
 * column except the icon columns is headed by its widget label, so no stored
 * presets-page name can show through. `presetName` scopes the browser keys the
 * shared column hook reads, so pass a widget-scoped name.
 */
export function useWidgetAlertColumns({
  item,
  alerts,
  presetName,
  presetNoisy,
}: {
  item: WidgetData;
  alerts?: AlertDto[];
  presetName: string;
  presetNoisy?: boolean;
}): { columns: ColumnDef<AlertDto>[]; allColumnIds: string[] } {
  const alertKeys = useStableIds(
    getAdditionalColsToGenerate(alerts ?? NO_ALERTS)
  );
  const knownIds = useMemo(
    () => new Set<string>([...WIDGET_STATIC_COLUMN_IDS, ...alertKeys]),
    [alertKeys]
  );
  const groupBy = item.alertTable?.groupBy;
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
    presetNoisy,
  });

  const renames = item.alertTable?.columnRenameMapping;
  const columns = useMemo(
    () =>
      normalizeEmptyGrouping(tableColumns.filter(isShownInWidget)).map(
        (column) =>
          WIDGET_PINNED_LEFT.includes(column.id as string)
            ? column
            : { ...column, header: getColumnLabel(column.id as string, renames) }
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
