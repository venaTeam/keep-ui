import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  Column,
  ColumnDef,
  ColumnOrderState,
  VisibilityState,
  getCoreRowModel,
  getGroupedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table } from "@tremor/react";
import { AlertDto } from "@/entities/alerts/model";
import AlertsTableHeaders from "@/widgets/alerts-table/ui/alert-table-headers";

jest.mock("@/entities/alerts/model/useAlertRowStyle", () => ({
  useAlertRowStyle: () => ["default", jest.fn()],
}));

const DEFAULT_COLUMN_IDS = ["name", "description", "service"];
const NO_DATA: AlertDto[] = [];

type HarnessProps = {
  columnIds?: string[];
  visibleIds?: string[];
  data?: AlertDto[];
  enableSorting?: boolean;
  interactive?: boolean;
  showSortItems?: boolean;
  showFormatItems?: boolean;
  getOriginalColumnName?: (columnId: string) => string;
  canFormatAsList?: (column: Column<AlertDto>) => boolean;
};

const buildColumns = (ids: string[]): ColumnDef<AlertDto>[] =>
  ids.map((id) => ({
    id,
    accessorKey: id,
    header: id,
    enableGrouping: true,
  })) as ColumnDef<AlertDto>[];

const Harness = ({
  columnIds = DEFAULT_COLUMN_IDS,
  visibleIds,
  data = NO_DATA,
  enableSorting = true,
  ...headerProps
}: HarnessProps) => {
  const columns = React.useMemo(() => buildColumns(columnIds), [columnIds]);
  const columnOrder: ColumnOrderState = columnIds;
  const columnVisibility: VisibilityState = visibleIds
    ? Object.fromEntries(columnIds.map((id) => [id, visibleIds.includes(id)]))
    : {};
  const a11yContainerRef = React.useRef<HTMLDivElement | null>(null);

  const table = useReactTable<AlertDto>({
    data,
    columns,
    enableSorting,
    state: { columnOrder, columnVisibility },
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    columnResizeMode: "onChange",
  });

  return (
    <div ref={a11yContainerRef}>
      <Table>
        <AlertsTableHeaders
          columns={columns}
          table={table}
          presetName="test"
          a11yContainerRef={a11yContainerRef}
          columnTimeFormats={{}}
          setColumnTimeFormats={jest.fn()}
          columnListFormats={{}}
          setColumnListFormats={jest.fn()}
          columnOrder={columnOrder}
          setColumnOrder={jest.fn()}
          columnVisibility={columnVisibility}
          setColumnVisibility={jest.fn()}
          columnRenameMapping={{}}
          setColumnRenameMapping={jest.fn()}
          {...headerProps}
        />
      </Table>
    </div>
  );
};

const renderHeaders = (props: HarnessProps = {}) =>
  render(<Harness {...props} />);

const openMenuFor = async (columnId: string) => {
  const cell = screen.getByTestId(`header-cell-${columnId}`);
  const trigger = within(cell).getByTestId("dropdown-menu-button");
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
  return screen.findByTestId("dropdown-menu-list");
};

const isDisabled = (label: string) =>
  screen.getByText(label).closest("button")?.hasAttribute("disabled") ?? false;

describe("AlertsTableHeaders", () => {
  it("default props render the drag handle, resize edge and menu exactly as the presets page does", async () => {
    renderHeaders({});
    expect(screen.getByTestId("drag-handle-name")).toBeInTheDocument();
    expect(screen.getByTestId("resize-handle-name")).toBeInTheDocument();
    await openMenuFor("name");
    expect(screen.getByText("Sort ascending")).toBeInTheDocument();
    expect(screen.getByText("Sort descending")).toBeInTheDocument();
    expect(screen.getByText("Group by")).toBeInTheDocument();
    expect(screen.getByText(/rename column/i)).toBeInTheDocument();
    expect(screen.getByText("Auto-fit column")).toBeInTheDocument();
    expect(screen.getByText("Reset width")).toBeInTheDocument();
    expect(screen.getByText("Move column left")).toBeInTheDocument();
    expect(screen.getByText("Move column right")).toBeInTheDocument();
    expect(screen.getByText("Remove column")).toBeInTheDocument();
  });

  it("with sorting disabled on the default props the menu has no Rename or Group by, as today", async () => {
    renderHeaders({ enableSorting: false });
    await openMenuFor("name");
    expect(screen.queryByText("Sort ascending")).toBeNull();
    expect(screen.queryByText("Group by")).toBeNull();
    expect(screen.queryByText(/rename column/i)).toBeNull();
    expect(screen.getByText("Remove column")).toBeInTheDocument();
  });

  it("interactive=false renders no drag handle, resize edge or menu", () => {
    renderHeaders({ interactive: false });
    const cell = screen.getByTestId("header-cell-name");
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.queryByTestId("drag-handle-name")).toBeNull();
    expect(screen.queryByTestId("resize-handle-name")).toBeNull();
    expect(within(cell).queryByTestId("dropdown-menu-button")).toBeNull();
    expect(screen.queryByRole("button", { name: /column menu|open menu/i })).toBeNull();
  });

  it("with sorting disabled the menu still offers Rename and Group by, and no sort items", async () => {
    renderHeaders({
      enableSorting: false,
      showSortItems: false,
      showFormatItems: false,
    });
    await openMenuFor("name");
    expect(screen.getByText("Group by")).toBeInTheDocument();
    expect(screen.getByText(/rename/i)).toBeInTheDocument();
    expect(screen.queryByText("Sort ascending")).toBeNull();
    expect(screen.queryByText("Sort descending")).toBeNull();
  });

  it("showSortItems=false hides the sort items even when the column can sort", async () => {
    renderHeaders({ showSortItems: false });
    await openMenuFor("name");
    expect(screen.queryByText("Sort ascending")).toBeNull();
    expect(screen.queryByText("Sort descending")).toBeNull();
    expect(screen.getByText("Group by")).toBeInTheDocument();
    expect(screen.getByText(/rename column/i)).toBeInTheDocument();
  });

  it("with sorting disabled and sort items hidden, a date column offers Format time", async () => {
    renderHeaders({
      columnIds: ["lastReceived", "name"],
      enableSorting: false,
      showSortItems: false,
    });
    await openMenuFor("lastReceived");
    expect(screen.getByText("Format time")).toBeInTheDocument();
  });

  it("with sorting disabled and the default props, there is no Format time, as on the presets page", async () => {
    renderHeaders({
      columnIds: ["lastReceived", "name"],
      enableSorting: false,
    });
    await openMenuFor("lastReceived");
    expect(screen.queryByText("Format time")).toBeNull();
  });

  it("Move right is disabled only on the last column when there is no alertMenu column", async () => {
    renderHeaders({});
    await openMenuFor("description");
    expect(isDisabled("Move column right")).toBe(false);
    fireEvent.keyDown(document.body, { key: "Escape" });
    await openMenuFor("service");
    expect(isDisabled("Move column right")).toBe(true);
  });

  it("Move right is disabled on the last non-alertMenu column when alertMenu is last", async () => {
    renderHeaders({ columnIds: ["name", "service", "alertMenu"] });
    await openMenuFor("service");
    expect(isDisabled("Move column right")).toBe(true);
    fireEvent.keyDown(document.body, { key: "Escape" });
    await openMenuFor("name");
    expect(isDisabled("Move column right")).toBe(false);
  });

  describe("Rename", () => {
    const openRenameFor = async (columnId: string) => {
      await openMenuFor(columnId);
      const rename = screen.getByText(/rename column/i);
      fireEvent.pointerEnter(rename);
      fireEvent.mouseMove(rename);
    };

    it("starts from the column id as words by default, as on the presets page", async () => {
      renderHeaders({ columnIds: ["node_name", "service"] });
      await openRenameFor("node_name");
      expect(await screen.findByDisplayValue("Node Name")).toBeInTheDocument();
    });

    it("starts from getOriginalColumnName when given", async () => {
      renderHeaders({
        columnIds: ["node_name", "service"],
        getOriginalColumnName: (columnId) =>
          columnId === "node_name" ? "Host" : columnId,
      });
      await openRenameFor("node_name");
      expect(await screen.findByDisplayValue("Host")).toBeInTheDocument();
    });
  });

  it("offers Format list on a list column by default, and not when canFormatAsList returns false", async () => {
    const data = [{ tags: JSON.stringify(["a", "b"]) }] as unknown as AlertDto[];
    const { unmount } = renderHeaders({ columnIds: ["name", "tags"], data });
    await openMenuFor("tags");
    expect(screen.getByText("Format list")).toBeInTheDocument();
    unmount();

    const canFormatAsList = jest.fn(() => false);
    renderHeaders({ columnIds: ["name", "tags"], data, canFormatAsList });
    await openMenuFor("tags");
    expect(screen.getByText(/rename column/i)).toBeInTheDocument();
    expect(screen.queryByText("Format list")).toBeNull();
    expect(canFormatAsList).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tags" })
    );
  });

  it("with one visible column the menu opens without throwing and Move right is disabled", async () => {
    renderHeaders({ visibleIds: ["name"] });
    await openMenuFor("name");
    expect(isDisabled("Move column right")).toBe(true);
    expect(isDisabled("Move column left")).toBe(true);
  });
});
