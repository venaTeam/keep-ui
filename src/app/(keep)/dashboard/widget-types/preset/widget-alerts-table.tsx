import React, {
  CSSProperties,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ColumnPinningState,
  Table as ReactTable,
  Row,
  RowSelectionState,
  Updater,
  functionalUpdate,
  getCoreRowModel,
  getGroupedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table } from "@tremor/react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import type { AlertDto } from "@/entities/alerts/model/types";
import {
  GROUP_ROW_SELECTION,
  QUICK_ACTIONS_TABLE_CLASS,
  QUICK_REVEAL_CLASS,
  getRangeIds,
  setIdsTicked,
} from "@/features/alerts/alert-quick-actions";
import { RowStyleOverrideProvider } from "@/entities/alerts/model/useAlertRowStyle";
import AlertsTableHeaders from "@/widgets/alerts-table/ui/alert-table-headers";
import { AlertsTableBody } from "@/widgets/alerts-table/ui/alerts-table-body";
import { getColumnLabel } from "@/widgets/alerts-table/lib/alert-column-options";
import { useGroupExpansion } from "@/utils/hooks/useGroupExpansion";
import { WidgetData } from "../../types";
import {
  NARROW_WIDGET_PX,
  QUICK_TRAY_COMPACT_PX,
  WIDGET_PINNED_LEFT,
  mergeVisibleColumnOrder,
} from "./alert-table-widget-config";
import {
  isGroupableColumn,
  withEmptyGroupPosition,
} from "./empty-group-row-model";
import { useWidgetAlertColumns } from "./use-widget-alert-columns";
import { useWidgetColumnState } from "./use-widget-column-state";
import {
  ColumnBounds,
  getColumnBounds,
  getWidgetColumnLayout,
  withUnclampedColumn,
} from "./widget-column-layout";
import {
  WidgetColumnWidths,
  WidgetTableSettings,
} from "./widget-table-settings";
import {
  CHECKBOX_COLUMN_ID,
  CHECKBOX_COLUMN_PX,
  QUICK_ACTION_COLUMNS,
  ROW_ACTIONS_COLUMN_ID,
} from "./widget-quick-action-columns";
import {
  WidgetRowActions,
  WidgetRowActionsContext,
} from "./widget-row-actions-context";

/** The selection the widget's caller holds, and the hooks the table's chrome calls. */
export interface WidgetSelectionProps {
  rowSelection: RowSelectionState;
  onRowSelectionChange: (next: RowSelectionState) => void;
  onOpenAction: (actionId: string, alerts: AlertDto[]) => void;
  openFingerprint: string | null;
}

interface WidgetAlertsTableProps {
  item: WidgetData;
  alerts?: AlertDto[];
  background?: string;
  isEditMode: boolean;
  onChange?: (item: WidgetData) => void;
  settingsSlot?: HTMLElement | null;
  selection?: WidgetSelectionProps;
}

const NO_ALERTS: AlertDto[] = [];
const NO_THEME: Record<string, string> = {};
const NO_FORMATS = {};
const SKELETON_ROWS = 5;
const OPAQUE_CELL_CLASSES =
  "[&_th]:[background:var(--widget-opaque-bg)] [&_td.sticky]:[background:var(--widget-opaque-bg)] [&_th.sticky]:z-40 [&_td.sticky]:z-10";
const COMPACT_GROUP_HEADER_CLASSES = "[&_td.group-header-cell]:py-1";
const TABLE_FEATURES = [GROUP_ROW_SELECTION];
const BORDER_TOLERANCE_PX = 0.01;

function noop() {}

function isAlertRow(row: Row<AlertDto>): boolean {
  return !row.getIsGrouped();
}

/** Ids of the alert rows in display order, leaving out the rows of collapsed groups. */
function getShownRowIds(
  rows: Row<AlertDto>[],
  isGroupExpanded: (groupId: string) => boolean
): string[] {
  return rows.flatMap((row) => {
    if (!row.getIsGrouped()) {
      return [row.id];
    }
    return isGroupExpanded(row.id)
      ? getShownRowIds(row.subRows, isGroupExpanded)
      : [];
  });
}

function useElementWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured !== undefined) {
        setWidth(Math.floor(measured));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

function useCollapsedBorderWidth(
  tableRef: RefObject<HTMLTableElement | null>
): number {
  const [borderWidth, setBorderWidth] = useState(0);

  useEffect(() => {
    const table = tableRef.current;
    if (!table || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      const cells = Array.from(table.tHead?.rows[0]?.cells ?? []);
      if (cells.length === 0) {
        return;
      }
      const cellsWidth = cells.reduce(
        (sum, cell) => sum + cell.getBoundingClientRect().width,
        0
      );
      const overhang = table.getBoundingClientRect().width - cellsWidth;
      setBorderWidth(Math.max(0, Math.ceil(overhang - BORDER_TOLERANCE_PX)));
    });
    observer.observe(table);
    return () => observer.disconnect();
  }, [tableRef]);

  return borderWidth;
}

function getColumnWidths(
  table: ReactTable<AlertDto>,
  bounds: ReadonlyMap<string, ColumnBounds>,
  tableRef: RefObject<HTMLElement | null>
): WidgetColumnWidths {
  return {
    columns: Object.fromEntries(
      table.getVisibleLeafColumns().map((column) => [
        column.id,
        {
          width: column.getSize(),
          ...(bounds.get(column.id) ?? getColumnBounds(column.columnDef)),
        },
      ])
    ),
    tableRef,
  };
}

function WidgetAlertsTableContent({
  item,
  alerts,
  background,
  isEditMode,
  onChange,
  settingsSlot,
  selection,
}: WidgetAlertsTableProps) {
  const widgetKey = `dashboard-widget-${item.i}`;
  const chromeSelection = isEditMode ? undefined : selection;
  const chrome = chromeSelection !== undefined;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const a11yContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const containerWidth = useElementWidth(wrapperRef);
  const borderWidth = useCollapsedBorderWidth(tableRef);
  const isNarrow = containerWidth !== null && containerWidth < NARROW_WIDGET_PX;
  const isTrayCompact =
    containerWidth !== null && containerWidth < QUICK_TRAY_COMPACT_PX;

  const { columns, allColumnIds } = useWidgetAlertColumns({
    item,
    alerts,
    presetName: widgetKey,
  });
  const state = useWidgetColumnState({ item, allColumnIds, onChange });
  const groupExpansion = useGroupExpansion(true);

  const ungroupableColumnIds = useMemo(
    () =>
      new Set(
        columns
          .filter((column) => !isGroupableColumn(column))
          .map((column) => column.id as string)
      ),
    [columns]
  );
  const isGroupable = useCallback(
    (columnId: string) => !ungroupableColumnIds.has(columnId),
    [ungroupableColumnIds]
  );
  const grouping = useMemo(
    () =>
      state.grouping.filter(
        (id) => isGroupable(id) && columns.some((column) => column.id === id)
      ),
    [state.grouping, columns, isGroupable]
  );
  const columnPinning = useMemo<ColumnPinningState>(() => {
    const pinnedLeft = WIDGET_PINNED_LEFT.filter((id) =>
      state.visibleColumns.includes(id)
    );
    return chrome
      ? {
          left: [CHECKBOX_COLUMN_ID, ...pinnedLeft],
          right: [ROW_ACTIONS_COLUMN_ID],
        }
      : { left: pinnedLeft, right: [] };
  }, [state.visibleColumns, chrome]);

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

  const {
    columnOrder: fullColumnOrder,
    columnVisibility,
    columnSizing: savedSizing,
    setColumnOrder,
  } = state;
  const visibleColumnOrder = useMemo(
    () => fullColumnOrder.filter((id) => columnVisibility[id]),
    [fullColumnOrder, columnVisibility]
  );
  const layout = useMemo(
    () =>
      getWidgetColumnLayout({
        columns,
        visibleOrder: visibleColumnOrder,
        savedSizing,
        containerWidth:
          containerWidth === null
            ? null
            : containerWidth - borderWidth - (chrome ? CHECKBOX_COLUMN_PX : 0),
      }),
    [
      columns,
      visibleColumnOrder,
      savedSizing,
      containerWidth,
      borderWidth,
      chrome,
    ]
  );
  const layoutColumns = useMemo(
    () => withUnclampedColumn(columns, layout.unclampedColumnId),
    [columns, layout.unclampedColumnId]
  );
  const columnBounds = useMemo(
    () =>
      new Map(
        columns.map((column) => [column.id as string, getColumnBounds(column)])
      ),
    [columns]
  );

  const tableSetup = useMemo(
    () =>
      chrome
        ? {
            columns: [
              QUICK_ACTION_COLUMNS.checkbox,
              ...layoutColumns,
              QUICK_ACTION_COLUMNS.rowActions,
            ],
            columnOrder: [
              CHECKBOX_COLUMN_ID,
              ...state.columnOrder,
              ROW_ACTIONS_COLUMN_ID,
            ],
            columnVisibility: {
              ...state.columnVisibility,
              [CHECKBOX_COLUMN_ID]: true,
              [ROW_ACTIONS_COLUMN_ID]: true,
            },
            columnSizing: {
              ...layout.columnSizing,
              [CHECKBOX_COLUMN_ID]: CHECKBOX_COLUMN_PX,
              [ROW_ACTIONS_COLUMN_ID]: 0,
            },
            tableWidth:
              layout.tableWidth === undefined
                ? undefined
                : layout.tableWidth + CHECKBOX_COLUMN_PX,
          }
        : {
            columns: layoutColumns,
            columnOrder: state.columnOrder,
            columnVisibility: state.columnVisibility,
            columnSizing: layout.columnSizing,
            tableWidth: layout.tableWidth,
          },
    [
      chrome,
      layoutColumns,
      state.columnOrder,
      state.columnVisibility,
      layout.columnSizing,
      layout.tableWidth,
    ]
  );

  const onRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      if (!chromeSelection) {
        return;
      }
      chromeSelection.onRowSelectionChange(
        functionalUpdate(updater, chromeSelection.rowSelection)
      );
    },
    [chromeSelection]
  );

  const table = useReactTable({
    _features: TABLE_FEATURES,
    data: alerts ?? NO_ALERTS,
    columns: tableSetup.columns,
    getRowId: (row) => row.fingerprint,
    state: {
      columnOrder: tableSetup.columnOrder,
      columnVisibility: tableSetup.columnVisibility,
      columnSizing: tableSetup.columnSizing,
      grouping,
      columnPinning,
      ...(chromeSelection
        ? { rowSelection: chromeSelection.rowSelection }
        : {}),
    },
    onColumnSizingChange: state.setColumnSizing,
    onGroupingChange: state.setGrouping,
    enableRowSelection: chrome ? isAlertRow : false,
    onRowSelectionChange: chrome ? onRowSelectionChange : undefined,
    enableSorting: false,
    manualSorting: true,
    enableGrouping: true,
    groupedColumnMode: false,
    columnResizeMode: "onEnd",
    autoResetAll: false,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: groupedRowModel,
  });

  const { isGroupExpanded } = groupExpansion;
  const lastPickRef = useRef<string | null>(null);
  const onPick = useCallback(
    (rowId: string, shiftKey: boolean) => {
      if (!chromeSelection) {
        return;
      }
      const current = chromeSelection.rowSelection;
      const order = getShownRowIds(table.getRowModel().rows, isGroupExpanded);
      const last = lastPickRef.current;
      const hasAnchor =
        last !== null &&
        Object.keys(current).length > 0 &&
        order.includes(last);
      const ids =
        shiftKey && hasAnchor ? getRangeIds(order, last, rowId) : [rowId];
      lastPickRef.current = rowId;
      chromeSelection.onRowSelectionChange(
        setIdsTicked(current, ids, !current[rowId])
      );
    },
    [chromeSelection, table, isGroupExpanded]
  );

  const isSelecting =
    !!chromeSelection && Object.keys(chromeSelection.rowSelection).length > 0;
  const rowActions = useMemo<WidgetRowActions | null>(
    () =>
      chromeSelection
        ? {
            isSelecting,
            compact: isTrayCompact,
            openFingerprint: chromeSelection.openFingerprint,
            onPick,
            onOpenAction: chromeSelection.onOpenAction,
          }
        : null,
    [chromeSelection, isSelecting, isTrayCompact, onPick]
  );

  const setVisibleColumnOrder = useCallback(
    (order: string[]) =>
      setColumnOrder(mergeVisibleColumnOrder(fullColumnOrder, order)),
    [fullColumnOrder, setColumnOrder]
  );

  const renames = state.columnRenameMapping;
  const labelOf = useCallback(
    (columnId: string) => getColumnLabel(columnId, renames),
    [renames]
  );

  const groupedBy = grouping[0];
  const allShownGroupsExpanded = table
    .getRowModel()
    .rows.filter((row) => row.getIsGrouped())
    .every((row) => groupExpansion.isGroupExpanded(row.id));
  const opaqueBackground = background
    ? `linear-gradient(${background}, ${background}), #fff`
    : "#fff";

  return (
    <div className="flex flex-col gap-1">
      {groupedBy && (
        <div
          className="flex items-center gap-2 text-xs"
          data-cy="dashboard-widget-alerts-table-toolbar"
        >
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
            onClick={
              allShownGroupsExpanded
                ? groupExpansion.collapseAll
                : groupExpansion.expandAll
            }
          >
            {allShownGroupsExpanded ? "Collapse all" : "Expand all"}
          </button>
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
        className={clsx(
          "isolate max-w-full overflow-x-auto border rounded-md text-xs",
          OPAQUE_CELL_CLASSES,
          COMPACT_GROUP_HEADER_CLASSES,
          chrome && QUICK_ACTIONS_TABLE_CLASS
        )}
        data-cy="dashboard-widget-alerts-table"
        data-selecting={isSelecting ? "" : undefined}
      >
        <WidgetRowActionsContext.Provider value={rowActions}>
          <Table
            ref={tableRef}
            style={
              tableSetup.tableWidth === undefined
                ? undefined
                : { width: tableSetup.tableWidth }
            }
            className="[&>table]:table-fixed [&>table]:w-full [&>table]:text-xs"
          >
            <AlertsTableHeaders
              columns={layoutColumns}
              table={table}
              presetName={widgetKey}
              a11yContainerRef={a11yContainerRef}
              columnTimeFormats={NO_FORMATS}
              setColumnTimeFormats={noop}
              columnListFormats={NO_FORMATS}
              setColumnListFormats={noop}
              columnOrder={visibleColumnOrder}
              setColumnOrder={setVisibleColumnOrder}
              columnVisibility={state.columnVisibility}
              setColumnVisibility={state.setColumnVisibility}
              columnRenameMapping={renames}
              setColumnRenameMapping={state.setColumnRenameMapping}
              interactive={isEditMode && !!onChange && !isNarrow}
              showSortItems={false}
              showFormatItems={false}
              getOriginalColumnName={getColumnLabel}
            />
            <AlertsTableBody
              table={table}
              showSkeleton={!alerts}
              pageSize={SKELETON_ROWS}
              theme={NO_THEME}
              lastViewedAlert={null}
              presetName={widgetKey}
              groupExpansionState={groupExpansion}
              rowAppearance="plain"
              selectable={chrome}
              dragSelectable={false}
              groupCheckboxClassName={QUICK_REVEAL_CLASS}
              showIncidentDetails
              linksDisabled={isEditMode}
              getColumnLabel={labelOf}
              inert={isEditMode}
            />
          </Table>
        </WidgetRowActionsContext.Provider>
        <div ref={a11yContainerRef} className="sr-only" />
      </div>
      {isEditMode &&
        state.canEdit &&
        settingsSlot &&
        createPortal(
          <WidgetTableSettings
            state={state}
            columnIds={allColumnIds}
            columnWidths={getColumnWidths(table, columnBounds, tableRef)}
            isGroupable={isGroupable}
          />,
          settingsSlot
        )}
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
 * Expand all / Collapse all reads the groups shown now, so a regrouping or a
 * refresh that drops a collapsed group does not leave it stale.
 * In edit mode with `onChange`, the ⚙ Table settings button is rendered into
 * `settingsSlot` (an element the caller places in its header), at every width;
 * its column widths are the rendered ones and its Auto-fit measures this table.
 *
 * Once the widget's width is measured, the table is laid out by
 * `getWidgetColumnLayout`: every column renders at exactly its own width, the
 * flexible text column takes any spare width so the table fills the widget,
 * and columns that do not fit scroll sideways. The width the table's
 * collapsed outer borders add (an incident group's colored edge) is measured
 * and left free, so a table that fits never scrolls.
 *
 * With `selection` and outside edit mode, the table adds its selection chrome:
 * a 28 px checkbox gutter pinned left, before the pinned icon columns, with a
 * select-all-shown header checkbox and a three-state checkbox on each group
 * header; and a zero-width row-actions column pinned right, whose quick-action
 * tray floats over the row's last cells and hides while anything is ticked.
 * Ticks live in the caller's `selection.rowSelection`, keyed by fingerprint and
 * never holding a group row; shift-click ticks the range in display order,
 * skipping the rows of collapsed groups, and with nothing ticked it acts as a
 * plain click, so a Clear leaves no anchor behind. The gutter's width comes
 * out of the layout, so the table still fills the widget exactly. In edit mode
 * there is no chrome, so none of it is saved or listed in the ⚙ panel.
 *
 * In edit mode the table body is `inert`: none of its links, rows or group
 * headers can be clicked or focused, so nothing in it navigates or reaches the
 * dashboard's leave guard as a link click. The headers, the grouping chip,
 * Expand all / Collapse all and the ⚙ panel (in `settingsSlot`) sit outside it
 * and keep working; a single group can't be toggled while editing.
 */
export default function WidgetAlertsTable(props: WidgetAlertsTableProps) {
  return (
    <RowStyleOverrideProvider value="default">
      <WidgetAlertsTableContent {...props} />
    </RowStyleOverrideProvider>
  );
}
