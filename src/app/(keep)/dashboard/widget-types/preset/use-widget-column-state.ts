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
  knownIds: ReadonlySet<string>
): GroupingState {
  const groupBy = getGroupByColumnId(item, knownIds);
  return groupBy && knownIds.has(groupBy) ? [groupBy] : [];
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
 * Saved visible columns and `groupBy` resolve against `allColumnIds` through
 * `resolveWidgetColumnId`, so a legacy snake_case id reads as its column.
 * Visible columns the order does not place follow it in their `presetColumns`
 * order, then every other column, so the visible order does not depend on the
 * order the loaded alerts list their fields in.
 * Nothing is read from the viewer's browser, so every viewer sees the same table.
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

  const knownIds = useMemo(() => new Set(allColumnIds), [allColumnIds]);
  const visibleColumns = useMemo(
    () => getVisibleColumnIds(item, knownIds),
    [item, knownIds]
  );
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
    () => getGrouping(item, knownIds),
    [item, knownIds]
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
          getVisibleColumnIds(latestItem.current, knownIds)
        ),
      }),
    [emit, knownIds]
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
        getGrouping(latestItem.current, knownIds)
      );
      const groupBy = next[0] ?? null;
      if (
        groupBy === (getGroupByColumnId(latestItem.current, knownIds) ?? null)
      ) {
        return;
      }
      emit({ groupBy });
    },
    [emit, knownIds]
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
      item.presetColumns !== undefined ||
      Object.keys(item.alertTable ?? {}).length > 0,
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
