import { useCallback, useEffect, useMemo, useRef } from "react";
import type {
  ColumnSizingState,
  GroupingState,
  Updater,
  VisibilityState,
} from "@tanstack/react-table";
import { DEFAULT_COLS } from "@/widgets/alerts-table/lib/alert-table-utils";
import type { WidgetData } from "../../types";
import {
  EmptyGroupPosition,
  WidgetColumnChange,
  applyWidgetColumnChange,
  getGroupByColumnId,
  getVisibleColumnIds,
  normalizeColumnOrder,
  resetWidgetColumns,
  toVisibilityState,
  visibleIdsFromVisibilityState,
} from "./alert-table-widget-config";

const NO_RENAMES: Record<string, string> = {};
const NO_SIZING: ColumnSizingState = {};

/** The column settings of one Alert Table widget, with the setters that change them. */
export interface WidgetColumnState {
  columnOrder: string[];
  columnVisibility: VisibilityState;
  visibleColumns: string[];
  columnRenameMapping: Record<string, string>;
  columnSizing: ColumnSizingState;
  grouping: GroupingState;
  emptyGroupPosition: EmptyGroupPosition;
  isCustomized: boolean;
  canEdit: boolean;
  setColumnOrder(order: string[]): void;
  setColumnVisibility(next: VisibilityState): void;
  setVisibleColumns(ids: string[]): void;
  setColumnRenameMapping(mapping: Record<string, string>): void;
  setColumnSizing(updater: Updater<ColumnSizingState>): void;
  setGrouping(updater: Updater<GroupingState>): void;
  setEmptyGroupPosition(position: EmptyGroupPosition): void;
  reset(): void;
}

function getGrouping(
  item: WidgetData,
  columnIds: ReadonlySet<string>
): GroupingState {
  const groupBy = getGroupByColumnId(item);
  return groupBy && columnIds.has(groupBy) ? [groupBy] : [];
}

function showsDefaultColumns(
  item: WidgetData,
  visibleColumns: readonly string[]
): boolean {
  const defaults = getVisibleColumnIds({ ...item, presetColumns: undefined });
  return (
    visibleColumns.length === defaults.length &&
    defaults.every((id) => visibleColumns.includes(id))
  );
}

function resolveUpdater<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function"
    ? (updater as (old: T) => T)(current)
    : updater;
}

/**
 * Reads and writes the column settings stored on an Alert Table widget.
 *
 * Each setting falls back on its own: the order to the shared default columns,
 * the renames and sizing to none, grouping to off and the empty group to the top.
 * Saved visible columns and `groupBy` resolve through `resolveWidgetColumnId`,
 * which never depends on the loaded alerts, so a snake_case id such as
 * `firing_counter` always reads as its column (`firingCounter`).
 * Visible columns the order does not place follow it in their `presetColumns`
 * order, then every other column, so the visible order does not depend on the
 * order the loaded alerts list their fields in.
 * Nothing is read from the viewer's browser, so every viewer sees the same table.
 *
 * `isCustomized` is true when `alertTable` holds a setting or the visible
 * columns, compared as a set once resolved, differ from the widget defaults.
 * A widget the form saved with the default columns is therefore not
 * customized. `reset` removes both `presetColumns` and `alertTable`.
 *
 * Setters pass the whole next widget to `onChange` and build on the latest widget
 * they emitted, so several calls in one tick compose. A grouping equal to the
 * saved one, once resolved, emits nothing, so neither clearing an ungrouped
 * widget nor choosing the column a saved snake_case `groupBy` resolves to marks
 * it customized. Without `onChange` the setters do nothing and `canEdit` is
 * false. Pass a memoized `allColumnIds` to keep the setters stable between
 * renders.
 */
export function useWidgetColumnState({
  item,
  allColumnIds,
  onChange,
}: {
  item: WidgetData;
  allColumnIds: string[];
  onChange?: (item: WidgetData) => void;
}): WidgetColumnState {
  const latestItem = useRef(item);

  useEffect(() => {
    latestItem.current = item;
  }, [item]);

  const columnIds = useMemo(() => new Set(allColumnIds), [allColumnIds]);
  const visibleColumns = useMemo(() => getVisibleColumnIds(item), [item]);
  const columnVisibility = useMemo(
    () => toVisibilityState(visibleColumns, allColumnIds),
    [visibleColumns, allColumnIds]
  );
  const savedOrder = item.alertTable?.columnOrder;
  const columnOrder = useMemo(
    () =>
      normalizeColumnOrder(
        [...(savedOrder ?? DEFAULT_COLS), ...visibleColumns],
        allColumnIds
      ),
    [savedOrder, visibleColumns, allColumnIds]
  );
  const grouping = useMemo(
    () => getGrouping(item, columnIds),
    [item, columnIds]
  );

  const emit = useCallback(
    (change: WidgetColumnChange) => {
      if (!onChange) {
        return;
      }
      const next = applyWidgetColumnChange(latestItem.current, change);
      latestItem.current = next;
      onChange(next);
    },
    [onChange]
  );

  const setColumnOrder = useCallback(
    (order: string[]) => emit({ columnOrder: order }),
    [emit]
  );
  const setVisibleColumns = useCallback(
    (ids: string[]) => emit({ visibleColumns: ids }),
    [emit]
  );
  const setColumnVisibility = useCallback(
    (next: VisibilityState) =>
      emit({
        visibleColumns: visibleIdsFromVisibilityState(
          next,
          getVisibleColumnIds(latestItem.current)
        ),
      }),
    [emit]
  );
  const setColumnRenameMapping = useCallback(
    (mapping: Record<string, string>) =>
      emit({ columnRenameMapping: mapping }),
    [emit]
  );
  const setColumnSizing = useCallback(
    (updater: Updater<ColumnSizingState>) =>
      emit({
        columnSizing: resolveUpdater(
          updater,
          latestItem.current.alertTable?.columnSizing ?? NO_SIZING
        ),
      }),
    [emit]
  );
  const setGrouping = useCallback(
    (updater: Updater<GroupingState>) => {
      const next = resolveUpdater(
        updater,
        getGrouping(latestItem.current, columnIds)
      );
      const groupBy = next[0] ?? null;
      if (
        groupBy === (getGroupByColumnId(latestItem.current) ?? null)
      ) {
        return;
      }
      emit({ groupBy });
    },
    [emit, columnIds]
  );
  const setEmptyGroupPosition = useCallback(
    (position: EmptyGroupPosition) => emit({ emptyGroupPosition: position }),
    [emit]
  );
  const reset = useCallback(() => {
    if (!onChange) {
      return;
    }
    const next = resetWidgetColumns(latestItem.current);
    latestItem.current = next;
    onChange(next);
  }, [onChange]);

  return {
    columnOrder,
    columnVisibility,
    visibleColumns,
    columnRenameMapping: item.alertTable?.columnRenameMapping ?? NO_RENAMES,
    columnSizing: item.alertTable?.columnSizing ?? NO_SIZING,
    grouping,
    emptyGroupPosition: item.alertTable?.emptyGroupPosition ?? "top",
    isCustomized:
      Object.keys(item.alertTable ?? {}).length > 0 ||
      !showsDefaultColumns(item, visibleColumns),
    canEdit: onChange !== undefined,
    setColumnOrder,
    setColumnVisibility,
    setVisibleColumns,
    setColumnRenameMapping,
    setColumnSizing,
    setGrouping,
    setEmptyGroupPosition,
    reset,
  };
}
