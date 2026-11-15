import React, {
  CSSProperties,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ColumnDef,
  ColumnPinningState,
  getCoreRowModel,
  getGroupedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table } from "@tremor/react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import type { AlertDto } from "@/entities/alerts/model/types";
import { RowStyleOverrideProvider } from "@/entities/alerts/model/useAlertRowStyle";
import AlertsTableHeaders from "@/widgets/alerts-table/ui/alert-table-headers";
import { AlertsTableBody } from "@/widgets/alerts-table/ui/alerts-table-body";
import { getColumnLabel } from "@/widgets/alerts-table/lib/alert-column-options";
import { useGroupExpansion } from "@/utils/hooks/useGroupExpansion";
import { WidgetData } from "../../types";
import { NARROW_WIDGET_PX, WIDGET_PINNED_LEFT } from "./alert-table-widget-config";
import { withEmptyGroupPosition } from "./empty-group-row-model";
import { useWidgetAlertColumns } from "./use-widget-alert-columns";
import {
  WidgetColumnState,
  useWidgetColumnState,
} from "./use-widget-column-state";

/** What `renderToolbar` receives: the widget's column state and every column id it can show. */
export interface WidgetAlertsTableToolbarContext {
  state: WidgetColumnState;
  columnIds: string[];
}

interface WidgetAlertsTableProps {
  item: WidgetData;
  presetName: string;
  presetId?: string;
  presetNoisy?: boolean;
  alerts?: AlertDto[];
  background?: string;
  isEditMode: boolean;
  onChange?: (item: WidgetData) => void;
  renderToolbar?: (context: WidgetAlertsTableToolbarContext) => ReactNode;
}

const NO_ALERTS: AlertDto[] = [];
const NO_THEME: Record<string, string> = {};
const NO_FORMATS = {};
const SKELETON_ROWS = 5;
const OPAQUE_CELL_CLASSES =
  "[&_th]:[background:var(--widget-opaque-bg)] [&_td.sticky]:[background:var(--widget-opaque-bg)] [&_th.sticky]:z-10 [&_td.sticky]:z-10";
const COMPACT_GROUP_HEADER_CLASSES = "[&_td.group-header-cell]:py-1";

function noop() {}

function isGroupable(column: ColumnDef<AlertDto>): boolean {
  return (
    column.getGroupingValue !== undefined && column.enableGrouping !== false
  );
}

function useIsNarrow(ref: RefObject<HTMLElement | null>): boolean {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) {
        setIsNarrow(width < NARROW_WIDGET_PX);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return isNarrow;
}

function WidgetAlertsTableContent({
  item,
  presetNoisy,
  alerts,
  background,
  isEditMode,
  onChange,
  renderToolbar,
}: WidgetAlertsTableProps) {
  const widgetKey = `dashboard-widget-${item.i}`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const a11yContainerRef = useRef<HTMLDivElement>(null);
  const isNarrow = useIsNarrow(wrapperRef);

  const { columns, allColumnIds } = useWidgetAlertColumns({
    item,
    alerts,
    presetName: widgetKey,
    presetNoisy,
  });
  const state = useWidgetColumnState({ item, allColumnIds, onChange });
  const groupExpansion = useGroupExpansion(true);

  const grouping = useMemo(
    () =>
      state.grouping.filter((id) =>
        columns.some((column) => column.id === id && isGroupable(column))
      ),
    [state.grouping, columns]
  );
  const columnPinning = useMemo<ColumnPinningState>(
    () => ({
      left: WIDGET_PINNED_LEFT.filter((id) => state.visibleColumns.includes(id)),
      right: [],
    }),
    [state.visibleColumns]
  );

  const emptyGroupPosition = useRef(state.emptyGroupPosition);
  emptyGroupPosition.current = state.emptyGroupPosition;
  const groupedRowModel = useMemo(
    () =>
      withEmptyGroupPosition<AlertDto>(
        getGroupedRowModel(),
        () => emptyGroupPosition.current
      ),
    []
  );

  const table = useReactTable({
    data: alerts ?? NO_ALERTS,
    columns,
    getRowId: (row) => row.fingerprint,
    state: {
      columnOrder: state.columnOrder,
      columnVisibility: state.columnVisibility,
      columnSizing: state.columnSizing,
      grouping,
      columnPinning,
    },
    onColumnSizingChange: state.setColumnSizing,
    onGroupingChange: state.setGrouping,
    enableSorting: false,
    manualSorting: true,
    enableGrouping: true,
    groupedColumnMode: false,
    columnResizeMode: "onEnd",
    autoResetAll: false,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: groupedRowModel,
  });

  const renames = state.columnRenameMapping;
  const labelOf = useCallback(
    (columnId: string) => getColumnLabel(columnId, renames),
    [renames]
  );

  const groupedBy = grouping[0];
  const toolbar = renderToolbar?.({ state, columnIds: allColumnIds });
  const opaqueBackground = background
    ? `linear-gradient(${background}, ${background}), #fff`
    : "#fff";

  return (
    <div className="flex flex-col gap-1">
      {(groupedBy || toolbar) && (
        <div
          className="flex items-center gap-2 text-xs"
          data-cy="dashboard-widget-alerts-table-toolbar"
        >
          {groupedBy && (
            <>
              <span
                className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-orange-800"
                data-cy="dashboard-widget-alerts-table-grouping"
              >
                Rows grouped by {labelOf(groupedBy)}
                {isEditMode && state.canEdit && (
                  <button
                    type="button"
                    aria-label="Clear grouping"
                    className="text-orange-700 hover:text-orange-900"
                    onClick={() => state.setGrouping([])}
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                )}
              </span>
              <button
                type="button"
                className="text-orange-700 hover:underline"
                onClick={groupExpansion.toggleAll}
              >
                {groupExpansion.areAllGroupsExpanded()
                  ? "Collapse all"
                  : "Expand all"}
              </button>
            </>
          )}
          {toolbar && <div className="ml-auto">{toolbar}</div>}
        </div>
      )}
      <div
        ref={wrapperRef}
        style={
          {
            background,
            "--widget-opaque-bg": opaqueBackground,
          } as CSSProperties
        }
        className={`max-w-full overflow-x-auto border rounded-md text-xs ${OPAQUE_CELL_CLASSES} ${COMPACT_GROUP_HEADER_CLASSES}`}
        data-cy="dashboard-widget-alerts-table"
      >
        <Table className="[&>table]:table-fixed [&>table]:w-full [&>table]:text-xs">
          <AlertsTableHeaders
            columns={columns}
            table={table}
            presetName={widgetKey}
            a11yContainerRef={a11yContainerRef}
            columnTimeFormats={NO_FORMATS}
            setColumnTimeFormats={noop}
            columnListFormats={NO_FORMATS}
            setColumnListFormats={noop}
            columnOrder={state.columnOrder}
            setColumnOrder={state.setColumnOrder}
            columnVisibility={state.columnVisibility}
            setColumnVisibility={state.setColumnVisibility}
            columnRenameMapping={renames}
            setColumnRenameMapping={state.setColumnRenameMapping}
            interactive={isEditMode && !!onChange && !isNarrow}
            showSortItems={false}
            showFormatItems={false}
          />
          <AlertsTableBody
            table={table}
            showSkeleton={!alerts}
            pageSize={SKELETON_ROWS}
            theme={NO_THEME}
            lastViewedAlert={null}
            presetName={widgetKey}
            groupExpansionState={groupExpansion}
            rowStyleOverride="default"
            rowAppearance="plain"
            selectable={false}
            showIncidentDetails
            linksDisabled={isEditMode}
            getColumnLabel={labelOf}
          />
        </Table>
        <div ref={a11yContainerRef} className="sr-only" />
      </div>
    </div>
  );
}

/**
 * The dashboard Alert Table widget: the widget's loaded alerts rendered with the
 * presets-page table parts, using the columns, order, names, widths and grouping
 * saved on the widget.
 *
 * Header controls show only in edit mode with `onChange`, and not on a narrow
 * widget. Rows are plain, not clickable and always at the default density.
 * `renderToolbar` renders next to the grouping chip with the same column state.
 */
export default function WidgetAlertsTable(props: WidgetAlertsTableProps) {
  return (
    <RowStyleOverrideProvider value="default">
      <WidgetAlertsTableContent {...props} />
    </RowStyleOverrideProvider>
  );
}
