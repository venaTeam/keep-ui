import type {
  ColumnDef,
  Row,
  RowModel,
  Table,
} from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import {
  normalizeEmptyGrouping,
  withEmptyGroupPosition,
} from "../empty-group-row-model";
import type { EmptyGroupPosition } from "../alert-table-widget-config";

type Item = { id: string; service?: string | null; tags?: string[] };

const table = {} as Table<Item>;

const groupRow = (value: string): Row<Item> =>
  ({
    id: `service:${value}`,
    groupingColumnId: "service",
    groupingValue: value,
  }) as unknown as Row<Item>;

const leafRow = (id: string): Row<Item> =>
  ({ id, groupingColumnId: undefined, groupingValue: undefined }) as unknown as Row<Item>;

const modelOf = (rows: Row<Item>[]): RowModel<Item> => ({
  rows,
  flatRows: rows,
  rowsById: Object.fromEntries(rows.map((row) => [row.id, row])),
});

const reordered = (
  getModel: () => RowModel<Item>,
  getPosition: () => EmptyGroupPosition
) => withEmptyGroupPosition<Item>(() => getModel, getPosition)(table);

const ids = (model: RowModel<Item>) => model.rows.map((row) => row.id);

describe("withEmptyGroupPosition", () => {
  it("moves the empty group to the top or to the bottom", () => {
    const base = modelOf([
      groupRow("checkout"),
      groupRow("undefined"),
      groupRow("payments"),
    ]);

    const top = reordered(() => base, () => "top")();
    const bottom = reordered(() => base, () => "bottom")();

    expect(ids(top)).toEqual([
      "service:undefined",
      "service:checkout",
      "service:payments",
    ]);
    expect(ids(bottom)).toEqual([
      "service:checkout",
      "service:payments",
      "service:undefined",
    ]);
    expect(top.flatRows).toBe(base.flatRows);
    expect(top.rowsById).toBe(base.rowsById);
  });

  it("leaves ungrouped models untouched", () => {
    const base = modelOf([leafRow("a"), leafRow("b")]);

    expect(reordered(() => base, () => "top")()).toBe(base);
    expect(reordered(() => base, () => "bottom")()).toBe(base);
  });

  it("returns the base model when the empty group already sits in place or is absent", () => {
    const alreadyFirst = modelOf([groupRow("null"), groupRow("checkout")]);
    const noEmpty = modelOf([groupRow("checkout"), groupRow("payments")]);

    expect(reordered(() => alreadyFirst, () => "top")()).toBe(alreadyFirst);
    expect(reordered(() => noEmpty, () => "bottom")()).toBe(noEmpty);
  });

  it("returns the identical object for the same base model and position", () => {
    let base = modelOf([groupRow("checkout"), groupRow("undefined")]);
    let position: EmptyGroupPosition = "top";
    const getModel = reordered(
      () => base,
      () => position
    );

    const first = getModel();
    expect(getModel()).toBe(first);

    position = "bottom";
    const atBottom = getModel();
    expect(atBottom).not.toBe(first);
    expect(ids(atBottom)).toEqual(["service:checkout", "service:undefined"]);
    expect(getModel()).toBe(atBottom);

    base = modelOf([groupRow("undefined"), groupRow("payments")]);
    expect(ids(getModel())).toEqual(["service:payments", "service:undefined"]);
  });
});

describe("normalizeEmptyGrouping", () => {
  const columnHelper = createColumnHelper<Item>();

  const groupingOf = (column: ColumnDef<Item>, row: Item) =>
    column.getGroupingValue?.(row);

  it("turns every empty grouping value into undefined, so empties share one group", () => {
    const [byAccessor, byGroupingValue] = normalizeEmptyGrouping<Item>([
      columnHelper.accessor((row) => row.service, { id: "service" }),
      columnHelper.accessor("service", {
        id: "service_key",
        getGroupingValue: (row) => row.service,
      }),
    ] as ColumnDef<Item>[]);

    [null, undefined, "", "null", "undefined"].forEach((service) => {
      const row = { id: "x", service } as Item;
      expect(groupingOf(byAccessor, row)).toBeUndefined();
      expect(groupingOf(byGroupingValue, row)).toBeUndefined();
    });
    expect(groupingOf(byAccessor, { id: "x", service: "checkout" })).toBe(
      "checkout"
    );
    expect(groupingOf(byGroupingValue, { id: "x", service: "checkout" })).toBe(
      "checkout"
    );
  });

  it("reads accessor-key columns and treats empty arrays as empty", () => {
    const [tags] = normalizeEmptyGrouping<Item>([
      columnHelper.accessor("tags", { id: "tags" }),
    ] as ColumnDef<Item>[]);

    expect(groupingOf(tags, { id: "x", tags: [] })).toBeUndefined();
    expect(groupingOf(tags, { id: "x", tags: ["a"] })).toEqual(["a"]);
  });

  it("leaves display columns without a grouping value", () => {
    const display = columnHelper.display({ id: "severity" }) as ColumnDef<Item>;

    const [normalized] = normalizeEmptyGrouping<Item>([display]);

    expect(normalized).toBe(display);
    expect(normalized.getGroupingValue).toBeUndefined();
  });
});
