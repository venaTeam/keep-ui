import React from "react";
import { render, screen, within } from "@testing-library/react";
import {
  createColumnHelper,
  getCoreRowModel,
  getGroupedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertsTableBody } from "@/widgets/alerts-table/ui/alerts-table-body";
import { AlertDto, Status, Severity } from "@/entities/alerts/model/types";

const mockSelectableGroup = jest.fn();

jest.mock("react-selectable-fast", () => {
  const React = require("react");
  return {
    SelectableGroup: (props: { children: React.ReactNode }) => {
      mockSelectableGroup(props);
      return React.createElement(React.Fragment, null, props.children);
    },
    createSelectable: (Component: React.ComponentType<any>) =>
      function SelectableMock(props: any) {
        return React.createElement(Component, { ...props, isSelecting: false });
      },
  };
});

const createMockAlert = (fingerprint: string, name: string): AlertDto => ({
  id: `alert-${fingerprint}`,
  fingerprint,
  name,
  description: "checkout",
  severity: Severity.Warning,
  status: Status.Firing,
  source: ["test-source"],
  lastReceived: new Date(),
  environment: "test",
  url: "https://example.com",
  pushed: true,
  assignee: undefined,
  deleted: false,
  event_id: `event-${fingerprint}`,
  enriched_fields: [],
  ticket_url: "",
});

const alerts = [
  createMockAlert("body-1", "Body alert 1"),
  createMockAlert("body-2", "Body alert 2"),
];

const columnHelper = createColumnHelper<AlertDto>();
const dataColumns = [
  columnHelper.accessor("name", {
    id: "name",
    cell: (context) => context.getValue(),
  }),
  columnHelper.accessor("description", {
    id: "description",
    cell: (context) => context.getValue(),
  }),
];
const columnsWithCheckbox = [
  columnHelper.display({ id: "checkbox", cell: () => null }),
  ...dataColumns,
];
const groupedByDescription = ["description"];
const ungrouped: string[] = [];

type RenderBodyOptions = Partial<
  React.ComponentProps<typeof AlertsTableBody>
> & {
  grouped?: boolean;
  withCheckboxColumn?: boolean;
};

function BodyHarness({
  grouped = false,
  withCheckboxColumn = false,
  ...props
}: RenderBodyOptions) {
  const table = useReactTable({
    data: alerts,
    columns: withCheckboxColumn ? columnsWithCheckbox : dataColumns,
    state: { grouping: grouped ? groupedByDescription : ungrouped },
    enableGrouping: true,
    groupedColumnMode: false,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getRowId: (row) => row.fingerprint,
  });

  return (
    <table>
      <AlertsTableBody
        table={table}
        showSkeleton={false}
        theme={{}}
        lastViewedAlert={null}
        presetName="body-test"
        {...props}
      />
    </table>
  );
}

const renderBody = (options: RenderBodyOptions = {}) =>
  render(<BodyHarness {...options} />);

describe("AlertsTableBody drag-select", () => {
  beforeEach(() => {
    localStorage.clear();
    mockSelectableGroup.mockClear();
  });

  it("wraps rows in the drag-select group by default when selectable", () => {
    renderBody({ selectable: true });
    expect(mockSelectableGroup).toHaveBeenCalled();
  });

  it("renders plain rows with selectable but dragSelectable false", () => {
    renderBody({ selectable: true, dragSelectable: false });
    expect(mockSelectableGroup).not.toHaveBeenCalled();
    expect(screen.getAllByRole("row").length).toBeGreaterThan(0);
  });

  it("still shows group checkboxes with dragSelectable false", () => {
    renderBody({
      selectable: true,
      dragSelectable: false,
      grouped: true,
      withCheckboxColumn: true,
    });
    const header = document.querySelector(
      '[data-cy="alerts-group-header"]'
    ) as HTMLElement;
    expect(within(header).getByRole("checkbox")).toBeInTheDocument();
  });
});
