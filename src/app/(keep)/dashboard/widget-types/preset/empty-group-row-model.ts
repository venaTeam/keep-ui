import type { ColumnDef, Row, RowModel, Table } from "@tanstack/react-table";
import { getNestedValue } from "@/shared/lib/object-utils";
import { isEmptyGroupValue } from "@/widgets/alerts-table/lib/group-values";
import type { EmptyGroupPosition } from "./alert-table-widget-config";

type RowModelFactory<T> = (table: Table<T>) => () => RowModel<T>;

function isEmptyGroup<T>(row: Row<T>): boolean {
  return (
    row.groupingColumnId !== undefined && isEmptyGroupValue(row.groupingValue)
  );
}

function placeEmptyGroup<T>(
  model: RowModel<T>,
  position: EmptyGroupPosition
): RowModel<T> {
  const index = model.rows.findIndex(isEmptyGroup);
  const targetIndex = position === "top" ? 0 : model.rows.length - 1;
  if (index === -1 || index === targetIndex) {
    return model;
  }
  const others = model.rows.filter((_, rowIndex) => rowIndex !== index);
  const rows =
    position === "top"
      ? [model.rows[index], ...others]
      : [...others, model.rows[index]];
  return { ...model, rows };
}

/**
 * Wraps a grouped row model so the "no value" group sits first or last.
 *
 * Only the top-level `rows` are reordered; `flatRows` and `rowsById` are the
 * base model's. The result is memoized on the base model's identity and the
 * position, so the same inputs return the same object, and a model with no
 * empty group (or an ungrouped one) is returned as is.
 */
export function withEmptyGroupPosition<T>(
  base: RowModelFactory<T>,
  getPosition: () => EmptyGroupPosition
): RowModelFactory<T> {
  return (table) => {
    const getBaseModel = base(table);
    let lastBase: RowModel<T> | undefined;
    let lastPosition: EmptyGroupPosition | undefined;
    let lastResult: RowModel<T> | undefined;
    return () => {
      const model = getBaseModel();
      const position = getPosition();
      if (
        lastResult === undefined ||
        model !== lastBase ||
        position !== lastPosition
      ) {
        lastBase = model;
        lastPosition = position;
        lastResult = placeEmptyGroup(model, position);
      }
      return lastResult;
    };
  };
}

function getGroupingSource<T>(
  column: ColumnDef<T>
): ((row: T) => unknown) | undefined {
  if (column.getGroupingValue) {
    return column.getGroupingValue;
  }
  if ("accessorFn" in column && column.accessorFn) {
    const accessorFn = column.accessorFn;
    return (row) => accessorFn(row, 0);
  }
  if ("accessorKey" in column && column.accessorKey !== undefined) {
    const accessorKey = String(column.accessorKey);
    return (row) => getNestedValue(row, accessorKey);
  }
  return undefined;
}

/**
 * Tells whether rows can be grouped by a column: it has a grouping value (a
 * `getGroupingValue` or an accessor) and does not turn grouping off. This is
 * the rule TanStack's `column.getCanGroup()` applies in a table with grouping
 * on, read from the column definition alone.
 */
export function isGroupableColumn<T>(column: ColumnDef<T>): boolean {
  return (
    getGroupingSource(column) !== undefined && column.enableGrouping !== false
  );
}

/**
 * Makes every empty grouping value of the given columns `undefined`.
 *
 * Grouping keys are the value's string form, so `null`, `undefined` and `""`
 * would otherwise make three groups. Each column with an accessor or a
 * `getGroupingValue` gets a `getGroupingValue` that returns `undefined` for any
 * value `isEmptyGroupValue` accepts; display columns are returned unchanged.
 */
export function normalizeEmptyGrouping<T>(
  columns: ColumnDef<T>[]
): ColumnDef<T>[] {
  return columns.map((column) => {
    const source = getGroupingSource(column);
    if (!source) {
      return column;
    }
    return {
      ...column,
      getGroupingValue: (row: T) => {
        const value = source(row);
        return isEmptyGroupValue(value) ? undefined : value;
      },
    };
  });
}
