import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { GroupedRow } from "@/widgets/alerts-table/ui/alert-grouped-row";
import { AlertsTableBody } from "@/widgets/alerts-table/ui/alerts-table-body";
import {
  Table,
  Row,
  Column,
  createColumnHelper,
  getCoreRowModel,
  getGroupedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertDto, Status, Severity } from "@/entities/alerts/model/types";
import { RowStyleOverrideProvider } from "@/entities/alerts/model/useAlertRowStyle";

jest.mock("react-selectable-fast", () => {
  const React = require("react");
  return {
    SelectableGroup: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement("tr", { "data-testid": "selectable-group" }),
        children
      ),
    createSelectable: (Component: React.ComponentType<any>) =>
      function SelectableMock(props: any) {
        return React.createElement(Component, { ...props, isSelecting: false });
      },
  };
});

const BACKGROUND_OR_POINTER = /(^|:)!?bg-|^cursor-pointer$/;

const backgroundOrPointerClasses = (element: Element) =>
  Array.from(element.classList).filter((token) =>
    BACKGROUND_OR_POINTER.test(token)
  );

const createMockAlert = (fingerprint: string, name: string): AlertDto => ({
  id: `alert-${fingerprint}`,
  fingerprint,
  name,
  description: "Test description",
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

describe("GroupedRow", () => {
  const createMockRow = (isGrouped: boolean, groupingValue?: string): Row<AlertDto> => ({
    id: "test-row",
    index: 0,
    original: createMockAlert("123", "Test alert"),
    depth: 0,
    subRows: isGrouped ? [
      { id: "sub-1", original: createMockAlert("456", "Test alert 1"), getVisibleCells: () => [] } as any,
      { id: "sub-2", original: createMockAlert("789", "Test alert 2"), getVisibleCells: () => [] } as any,
    ] : [],
    getIsGrouped: () => isGrouped,
    groupingColumnId: "status",
    groupingValue: groupingValue || "Test Group",
    getValue: (columnId: string) => groupingValue || "Test Group",
    renderValue: () => null,
    getCanExpand: () => isGrouped,
    getIsExpanded: () => false,
    getToggleExpandedHandler: () => () => {},
    getContext: () => ({} as any),
    getVisibleCells: () => [], 
  } as any);

  const mockTable = {
    getVisibleLeafColumns: () => [],
    getState: () => ({
      columnPinning: {
        left: [],
        right: []
      }
    })
  } as any;

  const mockTheme = {
    critical: "bg-red-100",
    warning: "bg-yellow-100",
    info: "bg-blue-100"
  };

  it("should show collapsed state when isExpanded is false", () => {
    const mockRow = createMockRow(true, "Test Group");
    const onToggleExpanded = jest.fn();

    const { container } = render(
      <table>
        <tbody>
          <GroupedRow
            row={mockRow}
            table={mockTable}
            theme={mockTheme}
            lastViewedAlert={null}
            rowStyle="default"
            isExpanded={false}
            onToggleExpanded={onToggleExpanded}
          />
        </tbody>
      </table>
    );

    // Check chevron rotation class - look for SVG element by class
    const svg = container.querySelector('svg');
    expect(svg?.className.baseVal).toContain("-rotate-90");
    
    // Sub rows should not be rendered
    expect(screen.queryByText("Test alert 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Test alert 2")).not.toBeInTheDocument();
  });

  it("should show expanded state when isExpanded is true", () => {
    const mockRow = createMockRow(true, "Test Group");
    const onToggleExpanded = jest.fn();

    const { container } = render(
      <table>
        <tbody>
          <GroupedRow
            row={mockRow}
            table={mockTable}
            theme={mockTheme}
            lastViewedAlert={null}
            rowStyle="default"
            isExpanded={true}
            onToggleExpanded={onToggleExpanded}
          />
        </tbody>
      </table>
    );

    // Check chevron is not rotated
    const svg = container.querySelector('svg');
    expect(svg?.className.baseVal).not.toContain("-rotate-90");
  });

  it("should format incident grouping correctly", () => {
    const mockRow = {
      ...createMockRow(true, '{"name": "incident-123"}'),
      groupingColumnId: "incident",
      original: {
        ...createMockAlert("123", "Test alert"),
        incident_dto: [{
          user_generated_name: "Production Outage",
          ai_generated_name: "Database Connection Issues"
        }]
      }
    } as any;
    
    const onToggleExpanded = jest.fn();

    render(
      <table>
        <tbody>
          <GroupedRow
            row={mockRow}
            table={mockTable}
            theme={mockTheme}
            lastViewedAlert={null}
            rowStyle="default"
            isExpanded={true}
            onToggleExpanded={onToggleExpanded}
          />
        </tbody>
      </table>
    );

    // Check if incident name is displayed
    expect(screen.getByText("Production Outage")).toBeInTheDocument();
  });

  it("should toggle expansion when clicked", () => {
    const mockRow = createMockRow(true, "Test Group");
    const onToggleExpanded = jest.fn();

    render(
      <table>
        <tbody>
          <GroupedRow
            row={mockRow}
            table={mockTable}
            theme={mockTheme}
            lastViewedAlert={null}
            rowStyle="default"
            isExpanded={false}
            onToggleExpanded={onToggleExpanded}
          />
        </tbody>
      </table>
    );

    // Click on the group header cell
    const groupHeader = screen.getByText("Test Group").closest("td");
    fireEvent.click(groupHeader!);

    // Check if toggleGroup was called with the correct group key
    expect(onToggleExpanded).toHaveBeenCalledWith("test-row");
  });

  describe("group labels and incident details", () => {
    let fingerprintCounter = 0;

    const alertWith = (overrides: Partial<AlertDto>): AlertDto => {
      fingerprintCounter += 1;
      return {
        ...createMockAlert(`fp-${fingerprintCounter}`, `Alert ${fingerprintCounter}`),
        ...overrides,
      };
    };

    const inc = (
      id: string,
      name: string,
      status: string,
      alerts_count: number
    ) => ({ id, user_generated_name: name, status, alerts_count });

    const alertIn = (...incidents: ReturnType<typeof inc>[]) =>
      alertWith({
        incident: incidents.map((incident) => incident.id).join(","),
        incident_dto: incidents,
      });

    const renderGroupedBy = (
      columnId: string,
      alerts: Partial<AlertDto>[],
      props: Partial<React.ComponentProps<typeof GroupedRow>> = {},
      groupCells: { column: { id: string } }[] = []
    ) => {
      const leaves = alerts.map((alert) => alertWith(alert));
      const first = leaves[0] as Record<string, any>;
      const row = {
        id: `${columnId}:${first[columnId]}`,
        original: first,
        depth: 0,
        groupingColumnId: columnId,
        groupingValue: `${first[columnId]}`,
        getIsGrouped: () => true,
        getValue: (id: string) => first[id],
        getVisibleCells: () => groupCells,
        getIsAllSubRowsSelected: () => false,
        getIsSomeSelected: () => false,
        getToggleSelectedHandler: () => () => {},
        subRows: leaves.map((leaf, index) => ({
          id: `sub-${index}`,
          original: leaf,
          getVisibleCells: () => [],
        })),
      } as any;

      return render(
        <table>
          <tbody>
            <GroupedRow
              row={row}
              table={mockTable}
              theme={mockTheme}
              lastViewedAlert={null}
              rowStyle="default"
              {...props}
            />
          </tbody>
        </table>
      );
    };

    it("labels an empty generic group 'No <label>' instead of 'undefined'", () => {
      renderGroupedBy("service", [{ fingerprint: "a" }], {
        getColumnLabel: () => "Service",
      });
      expect(screen.getByText("No Service")).toBeInTheDocument();
      expect(screen.queryByText("undefined")).toBeNull();
    });

    it("falls back to the start-cased column id for an empty group without getColumnLabel", () => {
      renderGroupedBy("node_name", [{ fingerprint: "a", node_name: null } as any]);
      expect(screen.getByText("No Node Name")).toBeInTheDocument();
      expect(screen.queryByText("null")).toBeNull();
    });

    it("labels the empty incident group 'No incident'", () => {
      renderGroupedBy("incident", [{ fingerprint: "a", incident: undefined }], {
        showIncidentDetails: true,
      });
      expect(screen.getByText("No incident")).toBeInTheDocument();
    });

    it("styles the empty incident group plainer than a real incident", () => {
      const { container } = renderGroupedBy(
        "incident",
        [{ fingerprint: "a", incident: undefined }],
        { showIncidentDetails: true }
      );
      const header = container.querySelector('[data-cy="alerts-group-header"]')!;
      expect(header.className).not.toContain("bg-orange-100");
      expect(header.querySelector("td")!.className).toContain("border-l-gray-400");
      expect(screen.getByText("No incident")).toHaveClass("italic");
    });

    it("keeps the presets-page 'No Incidents' label without showIncidentDetails", () => {
      renderGroupedBy("incident", [{ fingerprint: "a", incident: undefined }]);
      expect(screen.getByText("No Incidents")).toBeInTheDocument();
    });

    it("presets-page incident header is unchanged without showIncidentDetails", () => {
      renderGroupedBy("incident", [
        alertIn(inc("i1", "Checkout degraded", "firing", 14)),
      ]);
      expect(screen.getByText("Checkout degraded")).toBeInTheDocument();
      expect(screen.queryByText(/in incident/)).toBeNull();
    });

    it("with showIncidentDetails shows the linked name, status and 'x shown · y in incident'", () => {
      renderGroupedBy(
        "incident",
        [
          alertIn(inc("i1", "Checkout degraded", "firing", 14)),
          alertIn(inc("i1", "Checkout degraded", "firing", 14)),
        ],
        { showIncidentDetails: true }
      );
      expect(
        screen.getByRole("link", { name: "Checkout degraded" })
      ).toHaveAttribute("href", "/incidents/i1");
      expect(screen.getByText(/firing/i)).toBeInTheDocument();
      expect(screen.getByText("2 shown · 14 in incident")).toBeInTheDocument();
    });

    it("an alert in two incidents links both names, shows no status and 'in 2 incidents'", () => {
      renderGroupedBy(
        "incident",
        [
          alertIn(
            inc("i2", "Postgres storage", "firing", 2),
            inc("i3", "DB failover drill", "acknowledged", 2)
          ),
        ],
        { showIncidentDetails: true }
      );
      expect(
        screen.getByRole("link", { name: "Postgres storage" })
      ).toHaveAttribute("href", "/incidents/i2");
      expect(
        screen.getByRole("link", { name: "DB failover drill" })
      ).toHaveAttribute("href", "/incidents/i3");
      expect(screen.queryByText(/^firing$|^acknowledged$/i)).toBeNull();
      expect(screen.getByText("1 shown · in 2 incidents")).toBeInTheDocument();
    });

    it("with showIncidentDetails a group header counts what is shown", () => {
      const { container } = renderGroupedBy(
        "service",
        [{ service: "checkout" } as any, { service: "checkout" } as any],
        { showIncidentDetails: true }
      );
      expect(screen.getByText("2 shown")).toBeInTheDocument();
      expect(screen.queryByText(/alerts?\)/)).toBeNull();
      expect(
        container.querySelector('[data-cy="alerts-group-header"]')!.textContent
      ).toBe("checkout 2 shown");
    });

    it("with showIncidentDetails an empty generic group reads 'No <label>' and '<n> shown'", () => {
      const { container } = renderGroupedBy(
        "service",
        [{ service: undefined }, { service: undefined }],
        { showIncidentDetails: true, getColumnLabel: () => "Service" }
      );
      expect(
        container.querySelector('[data-cy="alerts-group-header"]')!.textContent
      ).toBe("No Service 2 shown");
    });

    it("with showIncidentDetails the empty incident group reads 'No incident · <n> shown'", () => {
      const { container } = renderGroupedBy(
        "incident",
        [
          { fingerprint: "a", incident: undefined },
          { fingerprint: "b", incident: undefined },
          { fingerprint: "c", incident: undefined },
        ],
        { showIncidentDetails: true }
      );
      expect(
        container.querySelector('[data-cy="alerts-group-header"]')!.textContent
      ).toBe("No incident · 3 shown");
      expect(screen.getByText("No incident")).toHaveClass("italic");
    });

    it("without showIncidentDetails the count keeps the presets-page '(n alerts)' form", () => {
      renderGroupedBy("service", [
        { service: "checkout" } as any,
        { service: "checkout" } as any,
      ]);
      expect(screen.getByText("(2 alerts)")).toBeInTheDocument();
      expect(screen.queryByText(/shown/)).toBeNull();
    });

    it("linksDisabled renders incident names as plain text", () => {
      renderGroupedBy(
        "incident",
        [alertIn(inc("i1", "Checkout degraded", "firing", 14))],
        { showIncidentDetails: true, linksDisabled: true }
      );
      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.getByText("Checkout degraded")).toBeInTheDocument();
    });

    it("clicking the incident link does not toggle the group", () => {
      const onToggle = jest.fn();
      renderGroupedBy(
        "incident",
        [alertIn(inc("i1", "Checkout degraded", "firing", 14))],
        { showIncidentDetails: true, onToggleExpanded: onToggle }
      );
      fireEvent.click(screen.getByRole("link", { name: "Checkout degraded" }));
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("plain appearance drops background and pointer classes from grouped alert rows", () => {
      const { container } = renderGroupedBy(
        "service",
        [{ service: "checkout" } as any, { service: "checkout" } as any],
        { rowAppearance: "plain" }
      );
      const rows = Array.from(container.querySelectorAll('[data-cy="alerts-row"]'));
      expect(rows).toHaveLength(2);
      rows.forEach((row) => expect(backgroundOrPointerClasses(row)).toEqual([]));
    });

    it("default appearance keeps the theme background and pointer on grouped alert rows", () => {
      const { container } = renderGroupedBy("service", [
        { service: "checkout" } as any,
      ]);
      const row = container.querySelector('[data-cy="alerts-row"]')!;
      expect(row).toHaveClass("bg-yellow-100", "cursor-pointer");
    });

    it("selectable={false} hides the group selection checkbox", () => {
      const checkboxCell = [{ column: { id: "checkbox" } }];
      const { unmount } = renderGroupedBy(
        "service",
        [{ service: "checkout" } as any],
        {},
        checkboxCell
      );
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
      unmount();

      renderGroupedBy(
        "service",
        [{ service: "checkout" } as any],
        { selectable: false },
        checkboxCell
      );
      expect(screen.queryByRole("checkbox")).toBeNull();
    });

    it("puts checkboxClassName on the group checkbox", () => {
      const { container } = renderGroupedBy(
        "service",
        [{ service: "checkout" } as any],
        { selectable: true, checkboxClassName: "quick-reveal" },
        [{ column: { id: "checkbox" } }]
      );
      const groupHeader = container.querySelector(
        '[data-cy="alerts-group-header"]'
      ) as HTMLElement;
      expect(within(groupHeader).getByRole("checkbox")).toHaveClass(
        "quick-reveal"
      );
    });
  });
});

describe("AlertsTableBody", () => {
  const columnHelper = createColumnHelper<AlertDto>();
  const columns = [
    columnHelper.accessor("name", {
      id: "name",
      cell: (context) => context.getValue(),
    }),
  ];
  const alerts = [
    createMockAlert("body-1", "Body alert 1"),
    createMockAlert("body-2", "Body alert 2"),
  ];

  function BodyHarness(
    props: Partial<React.ComponentProps<typeof AlertsTableBody>>
  ) {
    const table = useReactTable({
      data: alerts,
      columns,
      getCoreRowModel: getCoreRowModel(),
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

  const bodyRows = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-cy="alerts-row"]'));

  beforeEach(() => {
    localStorage.clear();
  });

  it("plain, non-selectable body rows carry no bg-white or cursor-pointer and no SelectableGroup", () => {
    const { container } = render(
      <BodyHarness rowAppearance="plain" selectable={false} />
    );
    expect(screen.queryByTestId("selectable-group")).toBeNull();
    const rows = bodyRows(container);
    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(backgroundOrPointerClasses(row)).toEqual([]);
      row
        .querySelectorAll("td")
        .forEach((cell) => expect(backgroundOrPointerClasses(cell)).toEqual([]));
    });
  });

  it("default body is unchanged: rows inside SelectableGroup", () => {
    const { container } = render(<BodyHarness />);
    expect(screen.getByTestId("selectable-group")).toBeInTheDocument();
    const rows = bodyRows(container);
    expect(rows).toHaveLength(2);
    rows.forEach((row) =>
      expect(row).toHaveClass("bg-white", "cursor-pointer", "h-8")
    );
  });

  it("a RowStyleOverrideProvider replaces the stored row style", () => {
    const { container } = render(
      <RowStyleOverrideProvider value="relaxed">
        <BodyHarness />
      </RowStyleOverrideProvider>
    );
    bodyRows(container).forEach((row) => {
      expect(row).toHaveClass("h-12");
      expect(row).not.toHaveClass("h-8");
    });
  });

  it("skeleton rows follow the RowStyleOverrideProvider and the plain appearance", () => {
    const { container } = render(
      <RowStyleOverrideProvider value="relaxed">
        <BodyHarness showSkeleton pageSize={2} rowAppearance="plain" />
      </RowStyleOverrideProvider>
    );
    const rows = Array.from(
      container.querySelectorAll('[data-cy="alerts-row-skeleton"]')
    );
    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(row).toHaveClass("h-12");
      expect(backgroundOrPointerClasses(row)).toEqual([]);
    });
  });

  it("skeleton rows draw one cell per visible column", () => {
    const { container } = render(<BodyHarness showSkeleton pageSize={2} />);
    const rows = Array.from(
      container.querySelectorAll('[data-cy="alerts-row-skeleton"]')
    );
    expect(rows).toHaveLength(2);
    rows.forEach((row) => expect(row.querySelectorAll("td")).toHaveLength(1));
  });

  it("inert makes the table body inert, rows and skeleton alike", () => {
    const { container, rerender } = render(<BodyHarness />);
    const body = () =>
      container.querySelector('[data-cy="alerts-table-body"]') as HTMLElement;
    expect(body()).not.toHaveAttribute("inert");

    rerender(<BodyHarness inert />);
    expect(body().tagName).toBe("TBODY");
    expect(body()).toHaveAttribute("inert");

    rerender(<BodyHarness inert selectable={false} />);
    expect(body()).toHaveAttribute("inert");

    rerender(<BodyHarness inert showSkeleton pageSize={1} />);
    expect(body()).toHaveAttribute("inert");
  });

  it("calls onRowClick when given", () => {
    const onRowClick = jest.fn();
    const { container } = render(<BodyHarness onRowClick={onRowClick} />);
    fireEvent.click(bodyRows(container)[0]);
    expect(onRowClick).toHaveBeenCalledWith(alerts[0]);
  });

  it("ignores row clicks without onRowClick", () => {
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener("error", onError);
    const { container } = render(<BodyHarness />);
    try {
      fireEvent.click(bodyRows(container)[0]);
    } catch (error) {
      errors.push(error);
    } finally {
      window.removeEventListener("error", onError);
    }
    expect(errors).toEqual([]);
  });

  it("cells of grouped alert rows carry data-column-id, so auto-fit can measure them", () => {
    const groupedColumns = [
      ...columns,
      columnHelper.accessor("description", {
        id: "description",
        cell: (context) => context.getValue(),
      }),
    ];

    function GroupedBodyHarness() {
      const table = useReactTable({
        data: alerts,
        columns: groupedColumns,
        state: { grouping: ["description"] },
        enableGrouping: true,
        groupedColumnMode: false,
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
          />
        </table>
      );
    }

    const { container } = render(<GroupedBodyHarness />);

    expect(
      container.querySelectorAll('[data-cy="alerts-group-header"]')
    ).toHaveLength(1);
    const rows = bodyRows(container);
    expect(rows).toHaveLength(2);
    rows.forEach((row) =>
      expect(
        Array.from(row.querySelectorAll("td")).map((cell) =>
          cell.getAttribute("data-column-id")
        )
      ).toEqual(["name", "description"])
    );
  });
});