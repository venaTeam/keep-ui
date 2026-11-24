import { renderHook } from "@testing-library/react";
import {
  ColumnDef,
  VisibilityState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ROW_ACTIONS_COLUMN_ID,
  getTrailingLinkColumnsPx,
} from "../widget-quick-action-columns";

jest.mock("@/features/alerts/alert-quick-actions/ui/action-dialogs", () => ({
  ChangeStatusDialog: () => null,
  LinkIncidentDialog: () => null,
  DismissDialog: () => null,
}));

const column = (id: string, size: number): ColumnDef<unknown> => ({
  id,
  size,
  minSize: 0,
  cell: () => null,
});

const trailingWidth = (
  columns: ColumnDef<unknown>[],
  columnVisibility: VisibilityState = {}
) =>
  renderHook(() =>
    getTrailingLinkColumnsPx(
      useReactTable({
        data: [],
        columns: [...columns, column(ROW_ACTIONS_COLUMN_ID, 0)],
        state: { columnVisibility },
        getCoreRowModel: getCoreRowModel(),
      })
    )
  ).result.current;

describe("getTrailingLinkColumnsPx", () => {
  it("is 0 when the last columns are not link columns", () => {
    expect(
      trailingWidth([column("name", 150), column("description", 200)])
    ).toBe(0);
  });

  it("sums the widths of trailing Rule and Runbook columns", () => {
    expect(
      trailingWidth([
        column("name", 150),
        column("alert_rule_url", 72),
        column("runbook_url", 60),
      ])
    ).toBe(132);
  });

  it("counts only the contiguous trailing run", () => {
    expect(
      trailingWidth([column("alert_rule_url", 72), column("name", 150)])
    ).toBe(0);
    expect(
      trailingWidth([
        column("runbook_url", 72),
        column("name", 150),
        column("alert_rule_url", 80),
      ])
    ).toBe(80);
  });

  it("skips a hidden link column", () => {
    expect(
      trailingWidth(
        [
          column("name", 150),
          column("alert_rule_url", 72),
          column("runbook_url", 60),
        ],
        { runbook_url: false }
      )
    ).toBe(72);
  });
});
