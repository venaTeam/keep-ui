import React from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import WidgetAlertsTable from "../widget-alerts-table";
import { WidgetData, WidgetType } from "../../../types";
import {
  WIDGET_STATIC_COLUMN_IDS,
  WIDGET_UNGROUPABLE_COLUMN_IDS,
} from "../alert-table-widget-config";
import { AlertDto, Severity, Status } from "@/entities/alerts/model/types";
import { useAlertTableCols } from "@/widgets/alerts-table/lib/alert-table-utils";
import {
  RowSelectionState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { isGroupableColumn } from "../empty-group-row-model";
import { useWidgetAlertColumns } from "../use-widget-alert-columns";
import { useConfig } from "@/utils/hooks/useConfig";

const mockUsePresetColumnState = jest.fn();
const mockGetAutofitColumnWidth = jest.fn();
const mockDndContextProps: {
  onDragEnd?: (event: {
    active: { id: string };
    over: { id: string } | null;
  }) => Promise<void> | void;
} = {};

jest.mock("@dnd-kit/core", () => {
  const actual = jest.requireActual("@dnd-kit/core");
  const { createElement } = jest.requireActual("react");
  return {
    ...actual,
    DndContext: (props: Record<string, unknown>) => {
      mockDndContextProps.onDragEnd = props.onDragEnd as never;
      return createElement(actual.DndContext, props);
    },
  };
});

jest.mock("@/entities/presets/model", () => ({
  ...jest.requireActual("@/entities/presets/model"),
  usePresetColumnState: (...args: unknown[]) =>
    mockUsePresetColumnState(...args),
}));

jest.mock("@/widgets/alerts-table/lib/column-autofit", () => {
  const actual = jest.requireActual(
    "@/widgets/alerts-table/lib/column-autofit"
  );
  return {
    ...actual,
    getAutofitColumnWidth: (...args: unknown[]) =>
      mockGetAutofitColumnWidth(...args),
  };
});

jest.mock("@/features/filter/hooks", () => ({
  ...jest.requireActual("@/features/filter/hooks"),
  useFacetPotentialFields: () => ({ data: ["labels.region"] }),
}));

jest.mock("@/utils/hooks/useProviders", () => ({
  useProviders: () => ({ data: undefined }),
}));

jest.mock("@/utils/hooks/useConfig", () => ({
  useConfig: jest.fn(() => ({ data: {} })),
  useApiUrl: () => "http://localhost:8080",
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard/atw",
}));

jest.mock("@/features/alerts/alert-quick-actions/ui/action-dialogs", () => ({
  ChangeStatusDialog: () => null,
  LinkIncidentDialog: () => null,
  DismissDialog: () => null,
}));

const baseItem: WidgetData = {
  i: "w1",
  x: 0,
  y: 0,
  w: 6,
  h: 4,
  static: false,
  name: "Feed",
  widgetType: WidgetType.PRESET,
};

let sequence = 0;

const alertWith = (fields: Record<string, unknown> = {}): AlertDto => {
  sequence += 1;
  return {
    id: `alert-${sequence}`,
    event_id: `event-${sequence}`,
    fingerprint: `fp-${sequence}`,
    name: `alert-${sequence}`,
    description: `description ${sequence}`,
    status: Status.Firing,
    severity: Severity.Warning,
    lastReceived: new Date("2026-10-01T10:00:00Z"),
    environment: "prod",
    source: ["prometheus"],
    pushed: true,
    deleted: false,
    ticket_url: "",
    enriched_fields: [],
    ...fields,
  } as AlertDto;
};

const linkedAlert = (incidentId: string, incidentName: string) =>
  alertWith({
    incident: incidentId,
    incident_dto: [
      {
        id: incidentId,
        user_generated_name: incidentName,
        status: "firing",
        alerts_count: 14,
      },
    ],
  });

const unlinkedAlert = () => alertWith({ incident: undefined });

type WidgetOptions = {
  isEditMode?: boolean;
  onChange?: (item: WidgetData) => void;
};

const widget = (
  overrides: Partial<WidgetData> = {},
  alerts: AlertDto[] | "loading" = [alertWith(), alertWith()],
  { isEditMode = false, onChange }: WidgetOptions = {}
) => (
  <WidgetAlertsTable
    item={{ ...baseItem, ...overrides }}
    alerts={alerts === "loading" ? undefined : alerts}
    isEditMode={isEditMode}
    onChange={onChange}
  />
);

const renderWidget = (...args: Parameters<typeof widget>) =>
  render(widget(...args));

const headerIds = () =>
  screen
    .queryAllByTestId(/^header-cell-/)
    .map((cell) => cell.getAttribute("data-testid")!.slice("header-cell-".length));

const groupHeaders = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('[data-cy="alerts-group-header"]')
  );

const groupHeaderTexts = () =>
  groupHeaders().map((header) => header.textContent?.trim() ?? "");

const groupHeader = (text: string) =>
  groupHeaders().find((header) => header.textContent?.includes(text))!;

const bodyRows = () =>
  Array.from(document.querySelectorAll('[data-cy="alerts-row"]'));

const cellsOf = (columnId: string) =>
  Array.from(document.querySelectorAll(`[data-cy="alerts-cell-${columnId}"]`));

const widgetRoot = () =>
  document.querySelector('[data-cy="dashboard-widget-alerts-table"]') as HTMLElement;

const mockedUseConfig = useConfig as jest.Mock;
const OriginalResizeObserver = window.ResizeObserver;

const observeWidth = (width: number) => {
  window.ResizeObserver = class {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      if (
        target.getAttribute("data-cy") !== "dashboard-widget-alerts-table" &&
        target.tagName !== "TABLE"
      ) {
        return;
      }
      this.callback(
        [{ target, contentRect: { width } } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
};

beforeEach(() => {
  localStorage.clear();
  mockGetAutofitColumnWidth
    .mockReset()
    .mockImplementation(
      jest.requireActual("@/widgets/alerts-table/lib/column-autofit")
        .getAutofitColumnWidth
    );
  mockUsePresetColumnState.mockReset();
  mockUsePresetColumnState.mockReturnValue({
    columnOrder: ["description", "name"],
    columnVisibility: {},
    columnRenameMapping: { name: "Alert" },
    setColumnOrder: jest.fn(),
    setColumnVisibility: jest.fn(),
    setColumnRenameMapping: jest.fn(),
  });
  mockedUseConfig.mockReturnValue({ data: {} });
});

afterEach(() => {
  window.ResizeObserver = OriginalResizeObserver;
});

describe("WidgetAlertsTable", () => {
  it("every static widget column id is one useAlertTableCols defines", () => {
    const { result } = renderHook(() =>
      useAlertTableCols({
        isCheckboxDisplayed: false,
        isMenuDisplayed: false,
        presetName: "drift-guard",
      })
    );
    const ids = result.current.map((column) => column.id);

    WIDGET_STATIC_COLUMN_IDS.forEach((id) => expect(ids).toContain(id));
  });

  it("lists exactly the static columns useAlertTableCols cannot group as ungroupable", () => {
    const { result } = renderHook(() =>
      useAlertTableCols({
        isCheckboxDisplayed: false,
        isMenuDisplayed: false,
        presetName: "drift-guard",
      })
    );
    const staticIds: readonly string[] = WIDGET_STATIC_COLUMN_IDS;
    const cannotGroup = result.current
      .filter((column) => staticIds.includes(column.id as string))
      .filter((column) => !isGroupableColumn(column))
      .map((column) => column.id as string);

    expect([...cannotGroup].sort()).toEqual(
      [...WIDGET_UNGROUPABLE_COLUMN_IDS].sort()
    );
  });

  it("the header's getCanGroup agrees with isGroupableColumn for every static column", () => {
    const { result } = renderHook(() => {
      const { columns } = useWidgetAlertColumns({
        item: { ...baseItem, presetColumns: [...WIDGET_STATIC_COLUMN_IDS] },
        alerts: [alertWith()],
        presetName: "drift-guard",
      });
      return useReactTable({
        data: [],
        columns,
        enableGrouping: true,
        getCoreRowModel: getCoreRowModel(),
      });
    });

    WIDGET_STATIC_COLUMN_IDS.forEach((id) => {
      const column = result.current.getColumn(id)!;
      expect([id, column.getCanGroup()]).toEqual([
        id,
        isGroupableColumn(column.columnDef),
      ]);
    });
  });

  it("legacy snake_case column shows the camelCase value", () => {
    renderWidget({ presetColumns: ["name", "last_received"] }, [
      alertWith({ lastReceived: "2026-10-01T10:00:00Z" }),
    ]);

    expect(screen.getByTestId("header-cell-lastReceived")).toBeInTheDocument();
    expect(cellsOf("lastReceived")[0].querySelector("span")).toHaveAttribute(
      "title",
      "2026-10-01T10:00:00.000Z"
    );
  });

  it("a saved snake_case column whose camelCase form is a known alert key shows the value", () => {
    renderWidget({ presetColumns: ["name", "duplicate_reason"] }, [
      alertWith({ duplicateReason: "same fingerprint" }),
    ]);

    expect(headerIds()).toEqual(["name", "duplicateReason"]);
    expect(cellsOf("duplicateReason")[0]).toHaveTextContent(
      "same fingerprint"
    );
  });

  it("an uncustomized widget uses the default columns, pinned icons first", () => {
    renderWidget();

    expect(headerIds()).toEqual([
      "severity",
      "status",
      "source",
      "name",
      "description",
      "lastReceived",
    ]);
  });

  it("an uncustomized widget uses the shared default order and names, not the preset store or old local storage", () => {
    localStorage.setItem(
      "keephq-column-order-atw",
      JSON.stringify(["description", "name"])
    );
    renderWidget({ presetColumns: ["description", "name"] });

    expect(headerIds()).toEqual(["name", "description"]);
    expect(screen.queryByText("Alert")).toBeNull();
    expect(screen.getByText("Alert name")).toBeInTheDocument();
  });

  it("widget order and renames win", () => {
    renderWidget({
      presetColumns: ["name", "description"],
      alertTable: {
        columnOrder: ["description", "name"],
        columnRenameMapping: { description: "Details" },
      },
    });

    expect(headerIds()).toEqual(["description", "name"]);
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("a configured column no alert has renders empty cells", () => {
    renderWidget({ presetColumns: ["name", "ticket_id"] });

    expect(screen.getByTestId("header-cell-ticket_id")).toHaveTextContent(
      "Ticket Id"
    );
    const cells = cellsOf("ticket_id");
    expect(cells).toHaveLength(2);
    cells.forEach((cell) => expect(cell.textContent).toBe(""));
  });

  it("unknown and excluded ids in config are ignored", () => {
    expect(() =>
      renderWidget({
        presetColumns: ["checkbox", "name"],
        alertTable: {
          columnOrder: ["alertMenu", "name"],
          groupBy: "does_not_exist",
        },
      })
    ).not.toThrow();

    expect(headerIds()).toEqual(["name"]);
    expect(groupHeaderTexts()).toEqual(["No Does Not Exist 2 shown"]);
  });

  it("never shows the noise column, even when noisy alerts are enabled", () => {
    mockedUseConfig.mockReturnValue({ data: { NOISY_ALERTS_ENABLED: true } });

    renderWidget({ presetColumns: ["noise", "name"] });

    expect(headerIds()).toEqual(["name"]);
  });

  it("groups by incident with 'No incident' first by default", () => {
    renderWidget({ alertTable: { groupBy: "incident" } }, [
      linkedAlert("i1", "Checkout degraded"),
      unlinkedAlert(),
    ]);

    const texts = groupHeaderTexts();
    expect(texts).toHaveLength(2);
    expect(texts[0]).toMatch(/^No incident · 1 shown$/);
    expect(texts[1]).toContain("Checkout degraded");
    expect(texts[1]).toContain("1 shown · 14 in incident");
  });

  it("groups by incident while the Incident column is hidden", () => {
    renderWidget(
      { presetColumns: ["name"], alertTable: { groupBy: "incident" } },
      [linkedAlert("i1", "Checkout degraded"), unlinkedAlert()]
    );

    expect(headerIds()).toEqual(["name"]);
    expect(groupHeaders()).toHaveLength(2);
  });

  it("null, undefined and empty-string values form ONE 'No Service' group", () => {
    renderWidget({ alertTable: { groupBy: "service" } }, [
      alertWith({ service: null }),
      alertWith({ service: undefined }),
      alertWith({ service: "" }),
      alertWith({ service: "checkout" }),
    ]);

    const texts = groupHeaderTexts();
    expect(texts.filter((text) => text.startsWith("No Service"))).toEqual([
      "No Service 3 shown",
    ]);
    expect(texts).toContain("checkout 1 shown");
  });

  it("a saved snake_case groupBy groups by the alerts' camelCase field", () => {
    renderWidget({ alertTable: { groupBy: "firing_counter" } }, [
      alertWith({ firingCounter: 3 }),
      alertWith({ firingCounter: 3 }),
      alertWith({ firingCounter: 5 }),
    ]);

    expect(groupHeaderTexts()).toEqual(["3 2 shown", "5 1 shown"]);
    expect(
      screen.getByText("Rows grouped by Firing Counter")
    ).toBeInTheDocument();
  });

  it("a saved groupBy on a list field renders ungrouped", () => {
    renderWidget({ alertTable: { groupBy: "enriched_fields" } }, [
      alertWith({ enriched_fields: ["a"] }),
      alertWith({ enriched_fields: ["b"] }),
    ]);

    expect(groupHeaders()).toHaveLength(0);
    expect(bodyRows()).toHaveLength(2);
    expect(screen.queryByText(/Rows grouped by/)).toBeNull();
  });

  it("the header cannot group a field whose loaded values are lists or objects", () => {
    const { result } = renderHook(() => {
      const { columns } = useWidgetAlertColumns({
        item: { ...baseItem, presetColumns: ["name", "enriched_fields", "region"] },
        alerts: [
          alertWith({ enriched_fields: ["a"], region: "eu" }),
          alertWith({ enriched_fields: [], region: "us" }),
        ],
        presetName: "list-guard",
      });
      return useReactTable({
        data: [],
        columns,
        enableGrouping: true,
        getCoreRowModel: getCoreRowModel(),
      });
    });

    const listColumn = result.current.getColumn("enriched_fields")!;
    expect(listColumn.getCanGroup()).toBe(false);
    expect(isGroupableColumn(listColumn.columnDef)).toBe(false);
    expect(result.current.getColumn("region")!.getCanGroup()).toBe(true);
  });

  it("a display-only group-by column renders ungrouped", () => {
    renderWidget({ alertTable: { groupBy: "severity" } });

    expect(groupHeaders()).toHaveLength(0);
    expect(bodyRows()).toHaveLength(2);
    expect(screen.queryByText(/Rows grouped by/)).toBeNull();
  });

  it("headers ignore the stale unscoped rename key in local storage", () => {
    localStorage.setItem(
      "keephq-column-rename-mapping-atw",
      JSON.stringify({ description: "Stale" })
    );

    renderWidget({ presetColumns: ["name", "description"] });

    expect(screen.queryByText("Stale")).toBeNull();
    expect(screen.getByTestId("header-cell-description")).toHaveTextContent(
      "Description"
    );
  });

  it("emptyGroupPosition bottom puts 'No incident' last", () => {
    renderWidget(
      { alertTable: { groupBy: "incident", emptyGroupPosition: "bottom" } },
      [unlinkedAlert(), linkedAlert("i1", "Checkout degraded")]
    );

    const texts = groupHeaderTexts();
    expect(texts[0]).toContain("Checkout degraded");
    expect(texts.at(-1)).toMatch(/^No incident/);
  });

  it("a changed emptyGroupPosition reorders the groups", () => {
    const alerts = [linkedAlert("i1", "Checkout degraded"), unlinkedAlert()];
    const { rerender } = renderWidget(
      { alertTable: { groupBy: "incident" } },
      alerts
    );
    expect(groupHeaderTexts()[0]).toMatch(/^No incident/);

    rerender(
      widget(
        { alertTable: { groupBy: "incident", emptyGroupPosition: "bottom" } },
        alerts
      )
    );

    expect(groupHeaderTexts().at(-1)).toMatch(/^No incident/);
  });

  it("group labels, the chip and empty groups use the widget's renames", () => {
    renderWidget(
      {
        alertTable: {
          groupBy: "service",
          columnRenameMapping: { service: "Svc" },
        },
      },
      [alertWith({ service: undefined }), alertWith({ service: "checkout" })]
    );

    expect(screen.getByText("Rows grouped by Svc")).toBeInTheDocument();
    expect(groupHeaderTexts()[0]).toBe("No Svc 1 shown");
  });

  it("view mode has no header controls; edit mode does", () => {
    const alerts = [alertWith(), alertWith()];
    const { rerender } = renderWidget({}, alerts, { isEditMode: false });
    expect(screen.queryByTestId("drag-handle-name")).toBeNull();
    expect(screen.queryByTestId("resize-handle-name")).toBeNull();

    rerender(widget({}, alerts, { isEditMode: true }));
    expect(screen.queryByTestId("drag-handle-name")).toBeNull();

    rerender(widget({}, alerts, { isEditMode: true, onChange: jest.fn() }));
    expect(screen.getByTestId("drag-handle-name")).toBeInTheDocument();
    expect(screen.getByTestId("resize-handle-name")).toBeInTheDocument();
  });

  it("a narrow widget hides the header controls in edit mode", () => {
    observeWidth(300);
    const { unmount } = renderWidget({}, undefined, {
      isEditMode: true,
      onChange: jest.fn(),
    });
    expect(screen.queryByTestId("drag-handle-name")).toBeNull();
    unmount();

    observeWidth(640);
    renderWidget({}, undefined, { isEditMode: true, onChange: jest.fn() });
    expect(screen.getByTestId("drag-handle-name")).toBeInTheDocument();
  });

  it("a default-size widget on a laptop keeps the header controls in edit mode", () => {
    observeWidth(360);
    renderWidget({}, undefined, { isEditMode: true, onChange: jest.fn() });
    expect(screen.getByTestId("drag-handle-name")).toBeInTheDocument();
  });

  describe("column widths", () => {
    const widthOf = (columnId: string) =>
      (screen.getByTestId(`header-cell-${columnId}`).closest("th") as HTMLElement)
        .style.width;

    it("starts every non-pinned column at its widget minimum width", () => {
      renderWidget({
        presetColumns: [
          "severity",
          "status",
          "source",
          "name",
          "description",
          "lastReceived",
          "assignee",
          "service",
        ],
      });

      expect(widthOf("name")).toBe("100px");
      expect(widthOf("description")).toBe("100px");
      expect(widthOf("lastReceived")).toBe("80px");
      expect(widthOf("assignee")).toBe("100px");
      expect(widthOf("service")).toBe("100px");
    });

    it("a saved width overrides the minimum", () => {
      renderWidget({ alertTable: { columnSizing: { name: 240 } } });

      expect(widthOf("name")).toBe("240px");
      expect(widthOf("description")).toBe("100px");
    });

    describe("at the widget's measured width", () => {
      const PINNED = ["severity", "status", "source"];
      const px = (value: string) => Number.parseFloat(value);
      const tableElement = () =>
        widgetRoot().querySelector("table") as HTMLTableElement;
      const renderedWidths = () =>
        Object.fromEntries(headerIds().map((id) => [id, px(widthOf(id))]));
      const sumOf = (widths: Record<string, number>) =>
        Object.values(widths).reduce((sum, width) => sum + width, 0);
      const declaredWidths = (overrides: Partial<WidgetData> = {}) => {
        const { unmount } = renderWidget(overrides);
        const widths = renderedWidths();
        unmount();
        return widths;
      };

      it("keeps the pinned columns at their declared width and gives description the rest", () => {
        const declared = declaredWidths();
        const total = sumOf(declared);

        observeWidth(total + 500);
        renderWidget();

        const rendered = renderedWidths();
        PINNED.forEach((id) => expect(rendered[id]).toBe(declared[id]));
        expect(rendered.name).toBe(declared.name);
        expect(rendered.lastReceived).toBe(declared.lastReceived);
        expect(rendered.description).toBe(declared.description + 500);
        expect(tableElement().style.width).toBe(`${total + 500}px`);
      });

      it("squeezes nothing below its minimum and overflows when the columns do not fit", () => {
        const declared = declaredWidths();

        observeWidth(250);
        renderWidget();

        const rendered = renderedWidths();
        expect(rendered).toEqual(declared);
        expect(rendered.name).toBeGreaterThanOrEqual(100);
        expect(rendered.description).toBeGreaterThanOrEqual(100);
        expect(tableElement().style.width).toBe(`${sumOf(declared)}px`);
        expect(widgetRoot()).toHaveClass("overflow-x-auto");
      });

      it("keeps a saved width on name exact while description flexes", () => {
        const item = { alertTable: { columnSizing: { name: 240 } } };
        const declared = declaredWidths(item);

        observeWidth(1200);
        renderWidget(item);

        const rendered = renderedWidths();
        expect(rendered.name).toBe(240);
        PINNED.forEach((id) => expect(rendered[id]).toBe(declared[id]));
        expect(rendered.description).toBe(
          declared.description + 1200 - sumOf(declared)
        );
        expect(tableElement().style.width).toBe("1200px");
      });

      it("lets description fill a very wide widget past its maximum", () => {
        const declared = declaredWidths();

        observeWidth(3000);
        renderWidget();

        const rendered = renderedWidths();
        expect(rendered.description).toBe(
          declared.description + 3000 - sumOf(declared)
        );
        expect(sumOf(rendered)).toBe(3000);
      });

      it("gives the spare width to name when description is hidden", () => {
        const item = { presetColumns: ["severity", "status", "name"] };
        const declared = declaredWidths(item);

        observeWidth(800);
        renderWidget(item);

        const rendered = renderedWidths();
        expect(rendered.status).toBe(declared.status);
        expect(rendered.name).toBe(declared.name + 800 - sumOf(declared));
      });

      it("leaves room for a collapsed outer border so a table that fits never scrolls", () => {
        const declared = declaredWidths();
        const width = sumOf(declared) + 500;
        const widthOfBox = (element: Element) =>
          px((element as HTMLElement).style.width) || 0;
        const rects = jest
          .spyOn(Element.prototype, "getBoundingClientRect")
          .mockImplementation(function (this: Element) {
            if (this.tagName !== "TABLE") {
              return { width: widthOfBox(this) } as DOMRect;
            }
            const cells = Array.from(this.querySelectorAll("thead th"));
            return {
              width: cells.reduce((sum, cell) => sum + widthOfBox(cell), 1.5),
            } as DOMRect;
          });

        try {
          observeWidth(width);
          renderWidget();

          const rendered = renderedWidths();
          PINNED.forEach((id) => expect(rendered[id]).toBe(declared[id]));
          expect(rendered.description).toBe(declared.description + 500 - 2);
          expect(tableElement().style.width).toBe(`${width - 2}px`);
        } finally {
          rects.mockRestore();
        }
      });
    });
  });

  it("Group by in the header menu writes the widget's groupBy", async () => {
    const onChange = jest.fn();
    renderWidget({ presetColumns: ["name", "description"] }, undefined, {
      isEditMode: true,
      onChange,
    });

    const cell = screen.getByTestId("header-cell-description");
    const trigger = within(cell).getByTestId("dropdown-menu-button");
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    await screen.findByTestId("dropdown-menu-list");
    expect(screen.queryByText("Sort ascending")).toBeNull();
    fireEvent.click(screen.getByText("Group by"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        alertTable: expect.objectContaining({ groupBy: "description" }),
      })
    );
  });

  it("header Rename starts from the name the header shows", async () => {
    renderWidget(
      { presetColumns: ["name", "node_name"] },
      [alertWith({ node_name: "db-1" })],
      { isEditMode: true, onChange: jest.fn() }
    );
    expect(
      within(screen.getByTestId("header-cell-node_name")).getByText("Host")
    ).toBeInTheDocument();

    const cell = screen.getByTestId("header-cell-node_name");
    const trigger = within(cell).getByTestId("dropdown-menu-button");
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    await screen.findByTestId("dropdown-menu-list");
    const rename = screen.getByText("Rename column");
    fireEvent.pointerEnter(rename);
    fireEvent.mouseMove(rename);

    expect(await screen.findByDisplayValue("Host")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Node Name")).toBeNull();
  });

  it("Move left on description puts it before name, skipping hidden columns", async () => {
    const onChange = jest.fn();
    const alerts = [alertWith(), alertWith()];
    const { rerender } = renderWidget({}, alerts, {
      isEditMode: true,
      onChange,
    });

    const cell = screen.getByTestId("header-cell-description");
    const trigger = within(cell).getByTestId("dropdown-menu-button");
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    await screen.findByTestId("dropdown-menu-list");
    fireEvent.click(screen.getByText("Move column left"));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next: WidgetData = onChange.mock.calls[0][0];
    const order = next.alertTable!.columnOrder!;
    expect(order.indexOf("description")).toBeLessThan(order.indexOf("name"));

    rerender(widget(next, alerts, { isEditMode: true, onChange }));
    expect(headerIds()).toEqual([
      "severity",
      "status",
      "source",
      "description",
      "name",
      "lastReceived",
    ]);
  });

  it("a header drag writes the full order with only the visible columns moved", async () => {
    const onChange = jest.fn();
    const savedOrder = [
      "severity",
      "source",
      "status",
      "name",
      "environment",
      "description",
      "lastReceived",
    ];
    render(
      <WidgetAlertsTable
        item={{ ...baseItem, alertTable: { columnOrder: savedOrder } }}
        alerts={[alertWith(), alertWith()]}
        isEditMode
        onChange={onChange}
      />
    );
    expect(headerIds()).not.toContain("environment");

    await act(async () => {
      await mockDndContextProps.onDragEnd!({
        active: { id: "lastReceived" },
        over: { id: "name" },
      });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const order: string[] = onChange.mock.calls[0][0].alertTable.columnOrder;
    expect(order.slice(0, savedOrder.length)).toEqual([
      "severity",
      "source",
      "status",
      "lastReceived",
      "environment",
      "name",
      "description",
    ]);
    expect(order).toContain("incident");
    expect(new Set(order).size).toBe(order.length);
  });

  it("shows the grouping chip with a clear button only in edit mode", () => {
    const onChange = jest.fn();
    const alerts = [linkedAlert("i1", "Checkout degraded"), unlinkedAlert()];
    const item = { alertTable: { groupBy: "incident" } };
    const { rerender } = renderWidget(item, alerts);

    expect(screen.getByText("Rows grouped by Incident")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear grouping" })).toBeNull();

    rerender(widget(item, alerts, { isEditMode: true, onChange }));
    fireEvent.click(screen.getByRole("button", { name: "Clear grouping" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).not.toHaveProperty("alertTable");
  });

  it("Collapse all and Expand all toggle every group", () => {
    renderWidget({ alertTable: { groupBy: "incident" } }, [
      linkedAlert("i1", "Checkout degraded"),
      unlinkedAlert(),
    ]);
    expect(bodyRows()).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(bodyRows()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(bodyRows()).toHaveLength(2);
  });

  it("after regrouping, the toggle reads from the shown groups and its first click collapses them", () => {
    const alerts = [
      linkedAlert("i1", "Checkout degraded"),
      alertWith({ service: "payments" }),
    ];
    const { rerender } = renderWidget(
      { alertTable: { groupBy: "environment" } },
      alerts
    );
    fireEvent.click(groupHeader("prod"));
    expect(screen.getByRole("button", { name: "Expand all" })).toBeInTheDocument();

    rerender(widget({ alertTable: { groupBy: "incident" } }, alerts));
    expect(bodyRows()).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Collapse all" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(bodyRows()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Expand all" })).toBeInTheDocument();
  });

  it("a refresh that drops the only collapsed group brings back Collapse all", () => {
    const { rerender } = renderWidget({ alertTable: { groupBy: "service" } }, [
      alertWith({ service: "checkout" }),
      alertWith({ service: "payments" }),
    ]);
    fireEvent.click(groupHeader("payments"));
    expect(screen.getByRole("button", { name: "Expand all" })).toBeInTheDocument();

    rerender(
      widget({ alertTable: { groupBy: "service" } }, [
        alertWith({ service: "checkout" }),
      ])
    );

    expect(bodyRows()).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Collapse all" })
    ).toBeInTheDocument();
  });

  it("a collapsed group stays collapsed after the alerts refresh", () => {
    const { rerender } = renderWidget({ alertTable: { groupBy: "incident" } }, [
      linkedAlert("i1", "Checkout degraded"),
    ]);
    expect(bodyRows()).toHaveLength(1);

    fireEvent.click(groupHeader("Checkout degraded"));
    expect(bodyRows()).toHaveLength(0);

    rerender(
      widget({ alertTable: { groupBy: "incident" } }, [
        linkedAlert("i1", "Checkout degraded"),
        linkedAlert("i1", "Checkout degraded"),
      ])
    );

    expect(groupHeaderTexts()[0]).toContain("2 shown");
    expect(bodyRows()).toHaveLength(0);
  });

  it("incident links in group headers work in view mode and are plain text in edit mode", () => {
    const alerts = [linkedAlert("i1", "Checkout degraded")];
    const item = { presetColumns: ["name"], alertTable: { groupBy: "incident" } };
    const { rerender } = renderWidget(item, alerts);

    expect(
      within(groupHeader("Checkout degraded")).getByRole("link", {
        name: "Checkout degraded",
      })
    ).toHaveAttribute("href", "/incidents/i1");

    rerender(widget(item, alerts, { isEditMode: true, onChange: jest.fn() }));

    expect(within(groupHeader("Checkout degraded")).queryByRole("link")).toBeNull();
  });

  describe("links and rows in edit mode", () => {
    const alerts = () => [
      alertWith({
        incident: "i1",
        incident_dto: [
          { id: "i1", user_generated_name: "Checkout degraded", status: "firing", alerts_count: 3 },
        ],
        runbook: "https://runbook.example.com/checkout",
      }),
    ];
    const item = { presetColumns: ["name", "incident", "runbook"] };
    const linkIn = (columnId: string) =>
      within(cellsOf(columnId)[0] as HTMLElement).getByRole("link");
    const tableBody = () =>
      widgetRoot().querySelector("tbody") as HTMLTableSectionElement;
    const isInsideInert = (element: Element) => !!element.closest("[inert]");

    it("in view mode the table body is not inert and its links are live", () => {
      renderWidget(item, alerts());

      expect(tableBody()).not.toHaveAttribute("inert");
      expect(isInsideInert(linkIn("incident"))).toBe(false);
      expect(isInsideInert(linkIn("runbook"))).toBe(false);
    });

    it("in edit mode every link and row sits inside the inert table body", () => {
      renderWidget(
        { ...item, alertTable: { groupBy: "incident" } },
        alerts(),
        { isEditMode: true, onChange: jest.fn() }
      );

      expect(tableBody()).toHaveAttribute("inert");
      [linkIn("incident"), linkIn("runbook"), ...bodyRows(), ...groupHeaders()].forEach(
        (element) => expect(isInsideInert(element)).toBe(true)
      );
    });

    it("in edit mode the headers, the grouping chip and Expand all stay usable", () => {
      renderWidget(
        { ...item, alertTable: { groupBy: "incident" } },
        alerts(),
        { isEditMode: true, onChange: jest.fn() }
      );

      expect(isInsideInert(widgetRoot().querySelector("thead")!)).toBe(false);
      expect(isInsideInert(screen.getByTestId("drag-handle-name"))).toBe(false);
      expect(
        isInsideInert(screen.getByRole("button", { name: "Clear grouping" }))
      ).toBe(false);
      const collapseAll = screen.getByRole("button", { name: "Collapse all" });
      expect(isInsideInert(collapseAll)).toBe(false);

      fireEvent.click(collapseAll);
      expect(bodyRows()).toHaveLength(0);
    });

    it("the body turns inert on entering edit mode and live again after it", () => {
      const data = alerts();
      const { rerender } = renderWidget(item, data);
      rerender(widget(item, data, { isEditMode: true, onChange: jest.fn() }));
      expect(tableBody()).toHaveAttribute("inert");

      rerender(widget(item, data));
      expect(tableBody()).not.toHaveAttribute("inert");
    });
  });

  it("rows render plain and not selectable", () => {
    renderWidget({ presetColumns: ["name"] });

    const rows = bodyRows();
    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(row).not.toHaveClass("cursor-pointer");
      expect(row).not.toHaveClass("bg-white");
    });
  });

  it("rows keep the default density whatever the viewer's row style", () => {
    localStorage.setItem(
      "keephq-alert-table-row-style",
      JSON.stringify("relaxed")
    );

    renderWidget({ presetColumns: ["name", "description"] });

    bodyRows().forEach((row) => {
      expect(row).toHaveClass("h-8");
      expect(row).not.toHaveClass("h-12");
    });
    cellsOf("description").forEach((cell) => {
      expect(cell.querySelector(".line-clamp-1")).not.toBeNull();
      expect(cell.querySelector(".line-clamp-3")).toBeNull();
    });
  });

  it("does not read the preset's expanded rows", () => {
    const alerts = [alertWith()];
    localStorage.setItem(
      "keephq-expanded-rows-atw",
      JSON.stringify({ [alerts[0].fingerprint]: true })
    );

    renderWidget({ presetColumns: ["name"] }, alerts);

    expect(bodyRows()[0]).not.toHaveClass("!h-auto");
  });

  it("pinned cells get an opaque background under the widget tint", () => {
    render(
      <WidgetAlertsTable
        item={baseItem}
        alerts={[alertWith()]}
        background="rgb(220, 38, 38, 0.1)"
        isEditMode={false}
      />
    );

    expect(widgetRoot().style.getPropertyValue("--widget-opaque-bg")).toBe(
      "linear-gradient(rgb(220, 38, 38, 0.1), rgb(220, 38, 38, 0.1)), #fff"
    );
    expect(cellsOf("severity")[0]).toHaveClass("sticky");
  });

  it("keeps the wrapper hooks: data-cy, sideways scroll, tint and small text", () => {
    render(
      <WidgetAlertsTable
        item={baseItem}
        alerts={[alertWith()]}
        background="rgba(16, 185, 129, 0.1)"
        isEditMode={false}
      />
    );

    expect(widgetRoot()).toHaveClass("overflow-x-auto", "text-xs");
    expect(widgetRoot().style.background).toBe("rgba(16, 185, 129, 0.1)");
  });

  it("skeleton rows match the widget's visible columns", () => {
    renderWidget(
      { presetColumns: ["name", "description", "lastReceived"] },
      "loading"
    );

    const rows = document.querySelectorAll('[data-cy="alerts-row-skeleton"]');
    expect(rows).toHaveLength(5);
    rows.forEach((row) => expect(row.querySelectorAll("td")).toHaveLength(3));
  });

  it("shows 5 skeleton rows while alerts are undefined", () => {
    renderWidget({}, "loading");

    expect(
      document.querySelectorAll('[data-cy="alerts-row-skeleton"]')
    ).toHaveLength(5);
    expect(bodyRows()).toHaveLength(0);
  });

  describe("⚙ table settings", () => {
    let slot: HTMLDivElement;

    beforeEach(() => {
      slot = document.createElement("div");
      document.body.appendChild(slot);
    });

    afterEach(() => slot.remove());

    const settingsButton = () =>
      document.querySelector('[data-cy="dashboard-widget-table-settings-btn"]');

    const renderWithSlot = (
      item: Partial<WidgetData>,
      options: WidgetOptions,
      alerts: AlertDto[] = [alertWith({ service: "checkout" })]
    ) =>
      render(
        <WidgetAlertsTable
          item={{ ...baseItem, ...item }}
          alerts={alerts}
          isEditMode={options.isEditMode ?? false}
          onChange={options.onChange}
          settingsSlot={slot}
        />
      );

    it("renders the ⚙ button into the settings slot only when editing", () => {
      const { unmount } = renderWithSlot({}, { isEditMode: false });
      expect(settingsButton()).toBeNull();
      unmount();

      const view = renderWithSlot({}, { isEditMode: true });
      expect(settingsButton()).toBeNull();
      view.unmount();

      const { container } = renderWithSlot(
        {},
        { isEditMode: true, onChange: jest.fn() }
      );
      expect(slot).toContainElement(settingsButton() as HTMLElement);
      expect(container).not.toContainElement(settingsButton() as HTMLElement);
    });

    it("stays available on a narrow widget", () => {
      observeWidth(300);
      renderWithSlot({}, { isEditMode: true, onChange: jest.fn() });

      expect(screen.queryByTestId("drag-handle-name")).toBeNull();
      expect(slot).toContainElement(settingsButton() as HTMLElement);
    });

    it("lists the widget's generated columns and writes through the widget store", () => {
      const onChange = jest.fn();
      renderWithSlot(
        { presetColumns: ["name", "description"] },
        { isEditMode: true, onChange }
      );

      fireEvent.click(settingsButton() as HTMLElement);
      expect(
        screen.getByRole("checkbox", { name: "Service" })
      ).not.toBeChecked();
      expect(
        screen.queryByRole("checkbox", { name: "Checkbox" })
      ).toBeNull();
      fireEvent.click(screen.getByRole("checkbox", { name: "Description" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].presetColumns).toEqual(["name"]);
    });

    it("a saved snake_case groupBy adds no empty column beside the real one", () => {
      renderWithSlot(
        { alertTable: { groupBy: "firing_counter" } },
        { isEditMode: true, onChange: jest.fn() },
        [alertWith({ firingCounter: 3 })]
      );

      fireEvent.click(settingsButton() as HTMLElement);
      const columnIds = Array.from(
        document.querySelectorAll("[data-table-settings-column]")
      ).map((row) => row.getAttribute("data-table-settings-column"));

      expect(columnIds).toContain("firingCounter");
      expect(columnIds).not.toContain("firing_counter");
    });

    it("does not offer a list field in Group rows by", async () => {
      renderWithSlot({}, { isEditMode: true, onChange: jest.fn() }, [
        alertWith({ enriched_fields: ["a"], region: "eu" }),
      ]);

      fireEvent.click(settingsButton() as HTMLElement);
      fireEvent.click(
        screen.getByRole("button", { name: "Show Group rows by options" })
      );
      const listbox = await screen.findByRole("listbox");

      expect(
        within(listbox).queryByRole("option", { name: "enriched_fields" })
      ).toBeNull();
      expect(
        within(listbox).getByRole("option", { name: "region" })
      ).toBeInTheDocument();
    });

    it("offers a list field as one column, never one column per item", () => {
      renderWithSlot({}, { isEditMode: true, onChange: jest.fn() }, [
        linkedAlert("i1", "Checkout degraded"),
        alertWith({ enriched_fields: ["service"] }),
      ]);

      fireEvent.click(settingsButton() as HTMLElement);
      const columnIds = Array.from(
        document.querySelectorAll("[data-table-settings-column]")
      ).map((row) => row.getAttribute("data-table-settings-column"));

      expect(columnIds).toEqual(
        expect.arrayContaining(["incident_dto", "enriched_fields"])
      );
      expect(columnIds.filter((id) => /\.\d+(\.|$)/.test(id ?? ""))).toEqual(
        []
      );
    });

    it("a widget the form saved with the default columns is not customized", () => {
      renderWithSlot(
        {
          presetColumns: [
            "severity",
            "status",
            "source",
            "name",
            "description",
            "lastReceived",
          ],
        },
        { isEditMode: true, onChange: jest.fn() }
      );

      fireEvent.click(settingsButton() as HTMLElement);

      expect(screen.queryByText("Customized for this widget")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Reset to defaults" })
      ).toBeDisabled();
    });

    it("a widget the form saved with other columns is customized, and Reset brings back the defaults", () => {
      const onChange = jest.fn();
      renderWithSlot(
        { presetColumns: ["name", "service"] },
        { isEditMode: true, onChange }
      );

      fireEvent.click(settingsButton() as HTMLElement);
      expect(
        screen.getByText("Customized for this widget")
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).not.toHaveProperty("presetColumns");
    });

    it("Reset to defaults emits one change that drops the widget's settings", () => {
      const onChange = jest.fn();
      renderWithSlot(
        {
          presetColumns: ["name"],
          alertTable: { groupBy: "service", columnRenameMapping: { name: "T" } },
        },
        { isEditMode: true, onChange }
      );

      fireEvent.click(settingsButton() as HTMLElement);
      fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const next: WidgetData = onChange.mock.calls[0][0];
      expect(next.presetColumns).toBeUndefined();
      expect(next.alertTable).toBeUndefined();
      expect(next.name).toBe("Feed");
    });

    describe("column widths in ⚙", () => {
      const openWidth = (label: string) => {
        fireEvent.click(settingsButton() as HTMLElement);
        fireEvent.click(
          screen.getByRole("button", { name: `Edit ${label} width` })
        );
        return screen.getByRole("spinbutton", { name: `${label} width` });
      };

      it("are offered on a narrow widget, without the header controls", () => {
        observeWidth(300);
        renderWithSlot({}, { isEditMode: true, onChange: jest.fn() });

        expect(screen.queryByTestId("resize-handle-name")).toBeNull();
        expect(openWidth("Alert name")).toHaveValue(100);
        expect(
          screen.queryByRole("button", { name: /Edit Severity width/ })
        ).toBeNull();
      });

      it("a typed width writes alertTable.columnSizing, clamped, once per commit", () => {
        const onChange = jest.fn();
        renderWithSlot(
          { alertTable: { columnSizing: { description: 300 } } },
          { isEditMode: true, onChange }
        );
        const input = openWidth("Alert name");

        fireEvent.change(input, { target: { value: "2" } });
        fireEvent.change(input, { target: { value: "25" } });
        fireEvent.change(input, { target: { value: "2500" } });
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.blur(input);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0].alertTable.columnSizing).toEqual({
          description: 300,
          name: 600,
        });
      });

      it("Auto-fit measures the widget's table and writes the width", () => {
        mockGetAutofitColumnWidth.mockReturnValue(222);
        const onChange = jest.fn();
        renderWithSlot({}, { isEditMode: true, onChange });
        openWidth("Description");

        fireEvent.click(
          screen.getByRole("button", { name: "Auto-fit Description" })
        );

        expect(mockGetAutofitColumnWidth).toHaveBeenCalledWith(
          widgetRoot().querySelector("table"),
          "description",
          { minSize: 100, maxSize: 800 }
        );
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0].alertTable.columnSizing).toEqual({
          description: 222,
        });
      });

      it("Reset removes the width and leaves an otherwise default widget uncustomized", () => {
        const onChange = jest.fn();
        const { rerender } = renderWithSlot(
          { alertTable: { columnSizing: { name: 240 } } },
          { isEditMode: true, onChange }
        );
        openWidth("Alert name");
        expect(
          screen.getByText("Customized for this widget")
        ).toBeInTheDocument();

        fireEvent.click(
          screen.getByRole("button", { name: "Reset Alert name width" })
        );

        expect(onChange).toHaveBeenCalledTimes(1);
        const next: WidgetData = onChange.mock.calls[0][0];
        expect(next.alertTable).toBeUndefined();
        expect(next.presetColumns).toBeUndefined();

        rerender(
          <WidgetAlertsTable
            item={next}
            alerts={[alertWith({ service: "checkout" })]}
            isEditMode
            onChange={onChange}
            settingsSlot={slot}
          />
        );
        expect(screen.queryByText("Customized for this widget")).toBeNull();
        expect(
          screen.getByRole("button", { name: "Reset to defaults" })
        ).toBeDisabled();
        expect(
          screen.queryByRole("button", { name: "Reset Alert name width" })
        ).toBeNull();
      });

      it("show the flexible column's rendered width on a wide widget", () => {
        observeWidth(1200);
        renderWithSlot({}, { isEditMode: true, onChange: jest.fn() });
        const rendered = Number.parseFloat(
          (
            screen
              .getByTestId("header-cell-description")
              .closest("th") as HTMLElement
          ).style.width
        );

        expect(rendered).toBeGreaterThan(100);
        expect(openWidth("Description")).toHaveValue(rendered);
      });
    });
  });

  it("contains the pinned cells' stacking inside the table", () => {
    renderWidget();

    expect(widgetRoot()).toHaveClass("isolate");
  });

  it("stacks pinned header cells above the resize edges and drop indicator of scrolled columns", () => {
    renderWidget();

    expect(widgetRoot()).toHaveClass("[&_th.sticky]:z-40");
  });

  it("never reads the preset's per-user column state", () => {
    renderWidget({ presetColumns: ["name", "description"] });

    expect(mockUsePresetColumnState).not.toHaveBeenCalled();
  });

  it("re-renders after an act-wrapped alerts refresh without losing the order", () => {
    const item = {
      presetColumns: ["name", "description"],
      alertTable: { columnOrder: ["description", "name"] },
    };
    const { rerender } = renderWidget(item, [alertWith()]);

    act(() => {
      rerender(widget(item, [alertWith({ region: "eu" }), alertWith()]));
    });

    expect(headerIds()).toEqual(["description", "name"]);
    expect(bodyRows()).toHaveLength(2);
  });

  describe("quick actions", () => {
    const onOpenAction = jest.fn();
    const onRowSelectionChange = jest.fn();

    const a1 = alertWith();
    const a2 = alertWith();
    const a3 = alertWith();
    const noInc1 = unlinkedAlert();
    const noInc2 = unlinkedAlert();
    const inInc1 = linkedAlert("i1", "Checkout degraded");
    const inInc2 = linkedAlert("i1", "Checkout degraded");
    const otherInc1 = linkedAlert("i2", "Payments down");

    type HarnessOptions = {
      alerts?: AlertDto[];
      groupBy?: string;
      isEditMode?: boolean;
      onChange?: (item: WidgetData) => void;
      settingsSlot?: HTMLElement;
      initial?: RowSelectionState;
      openFingerprint?: string | null;
    };

    function Harness({
      alerts = [a1],
      groupBy,
      isEditMode = false,
      onChange,
      settingsSlot,
      initial = {},
      openFingerprint = null,
    }: HarnessOptions) {
      const [rowSelection, setRowSelection] =
        React.useState<RowSelectionState>(initial);
      return (
        <>
          <button type="button" onClick={() => setRowSelection({})}>
            Clear selection
          </button>
          <WidgetAlertsTable
            item={{
              ...baseItem,
              ...(groupBy
                ? { alertTable: { groupBy, emptyGroupPosition: "top" } }
                : {}),
            }}
            alerts={alerts}
            isEditMode={isEditMode}
            onChange={onChange}
            settingsSlot={settingsSlot}
            selection={{
              rowSelection,
              onRowSelectionChange: (next) => {
                onRowSelectionChange(next);
                setRowSelection(next);
              },
              onOpenAction,
              openFingerprint,
            }}
          />
        </>
      );
    }

    const renderHarness = (options: HarnessOptions = {}) =>
      render(<Harness {...options} />);

    const lastSelection = (): RowSelectionState =>
      onRowSelectionChange.mock.calls.at(-1)?.[0];

    const checkboxFor = (alert: AlertDto) =>
      screen.getByRole("checkbox", { name: `Select ${alert.name}` });

    const rowFor = (alert: AlertDto) =>
      document.querySelector(
        `[data-cy="alerts-row"][data-cy-id="${alert.fingerprint}"]`
      ) as HTMLElement;

    const fingerprints = (...alerts: AlertDto[]) =>
      alerts.map((alert) => alert.fingerprint).sort();

    const selectedIds = () => Object.keys(lastSelection()).sort();

    beforeEach(() => {
      onOpenAction.mockReset();
      onRowSelectionChange.mockReset();
    });

    it("adds no gutter, tray or row selection without selection props", () => {
      render(
        <WidgetAlertsTable item={baseItem} alerts={[a1]} isEditMode={false} />
      );

      expect(screen.queryByRole("checkbox")).toBeNull();
      expect(document.querySelector('[data-column-id="alertMenu"]')).toBeNull();
      expect(widgetRoot()).not.toHaveClass("quick-actions-table");
    });

    it("adds nothing actionable in edit mode even with selection props", () => {
      renderHarness({ isEditMode: true });

      expect(screen.queryByRole("checkbox")).toBeNull();
      expect(screen.queryByRole("button", { name: /^Dismiss:/ })).toBeNull();
      expect(widgetRoot()).not.toHaveClass("quick-actions-table");
    });

    it("renders a row checkbox and the row's tray", () => {
      renderHarness({ alerts: [a1] });

      expect(checkboxFor(a1)).toBeInTheDocument();
      expect(checkboxFor(a1)).toHaveClass("quick-reveal", "quick-pick");
      expect(checkboxFor(a1)).toHaveAttribute("data-cy", "widget-row-checkbox");
      expect(
        screen.getByRole("checkbox", { name: "Select all shown alerts" })
      ).toHaveAttribute("data-cy", "widget-select-all");
      expect(
        screen.getByRole("button", { name: `Change Status: ${a1.name}` })
      ).toBeInTheDocument();
      expect(widgetRoot()).toHaveClass("quick-actions-table");
      expect(widgetRoot()).not.toHaveAttribute("data-selecting");
    });

    const trayButtons = (alert: AlertDto) =>
      Array.from(
        rowFor(alert).querySelectorAll<HTMLButtonElement>(
          '[data-cy^="widget-quick-action-"]'
        )
      );

    it("shows icon-only tray buttons on a widget under 640px", () => {
      observeWidth(600);
      renderHarness({ alerts: [a1] });

      expect(trayButtons(a1)).toHaveLength(3);
      expect(trayButtons(a1).map((button) => button.textContent)).toEqual([
        "",
        "",
        "",
      ]);
      expect(
        screen.getByRole("button", { name: `Change Status: ${a1.name}` })
      ).toHaveAttribute("title", "Change Status");
    });

    it("shows labelled tray buttons on a wide widget", () => {
      observeWidth(900);
      renderHarness({ alerts: [a1] });

      expect(trayButtons(a1).map((button) => button.textContent)).toEqual([
        "Change Status",
        "Link to incident",
        "Dismiss",
      ]);
    });

    it("pins the gutter left and the tray column right", () => {
      renderHarness({ alerts: [a1] });

      expect(headerIds()[0]).toBe("checkbox");
      expect(headerIds().at(-1)).toBe("alertMenu");
      expect(cellsOf("checkbox")[0]).toHaveClass("sticky");
      expect(cellsOf("alertMenu")[0]).toHaveClass("sticky", "overflow-visible");
    });

    it("opens an action for one row from its tray", () => {
      renderHarness({ alerts: [a1] });

      fireEvent.click(
        screen.getByRole("button", { name: `Dismiss: ${a1.name}` })
      );

      expect(onOpenAction).toHaveBeenCalledWith("dismiss", [a1]);
    });

    it("ticks a row by fingerprint and hides every tray while selecting", () => {
      renderHarness({ alerts: [a1, a2] });

      fireEvent.click(checkboxFor(a1));

      expect(lastSelection()).toEqual({ [a1.fingerprint]: true });
      expect(checkboxFor(a1)).toBeChecked();
      expect(
        screen.queryByRole("button", { name: /^Change Status:/ })
      ).toBeNull();
      expect(widgetRoot()).toHaveAttribute("data-selecting");
    });

    it("unticking the last row leaves an empty selection with no false values", () => {
      renderHarness({ alerts: [a1, a2] });

      fireEvent.click(checkboxFor(a1));
      fireEvent.click(checkboxFor(a1));

      expect(lastSelection()).toEqual({});
      expect(widgetRoot()).not.toHaveAttribute("data-selecting");
      expect(
        screen.getByRole("button", { name: `Change Status: ${a1.name}` })
      ).toBeInTheDocument();
    });

    it("selects all shown rows from the header", () => {
      renderHarness({ alerts: [a1, a2, a3] });

      fireEvent.click(
        screen.getByRole("checkbox", { name: "Select all shown alerts" })
      );

      expect(selectedIds()).toEqual(fingerprints(a1, a2, a3));
      expect(
        Object.values(lastSelection()).every((value) => value === true)
      ).toBe(true);
    });

    it("selects only alert rows from the header when grouped", () => {
      renderHarness({ alerts: [noInc1, inInc1], groupBy: "incident" });

      fireEvent.click(
        screen.getByRole("checkbox", { name: "Select all shown alerts" })
      );

      expect(selectedIds()).toEqual(fingerprints(noInc1, inInc1));
    });

    it("shift-click ticks the range in display order across groups", () => {
      renderHarness({
        alerts: [noInc1, noInc2, inInc1, inInc2],
        groupBy: "incident",
      });
      expect(groupHeaderTexts()[0]).toMatch(/^No incident/);

      fireEvent.click(checkboxFor(noInc1));
      fireEvent.click(checkboxFor(inInc1), { shiftKey: true });

      expect(selectedIds()).toEqual(fingerprints(noInc1, noInc2, inInc1));
    });

    it("shift-click unticks the range when the clicked row is ticked", () => {
      renderHarness({
        alerts: [a1, a2, a3],
        initial: {
          [a1.fingerprint]: true,
          [a2.fingerprint]: true,
          [a3.fingerprint]: true,
        },
      });

      fireEvent.click(checkboxFor(a1));
      fireEvent.click(checkboxFor(a2), { shiftKey: true });

      expect(lastSelection()).toEqual({ [a3.fingerprint]: true });
    });

    it("shift-click after Clear ticks only the clicked row", () => {
      renderHarness({ alerts: [a1, a2, a3] });

      fireEvent.click(checkboxFor(a1));
      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
      expect(checkboxFor(a1)).not.toBeChecked();
      fireEvent.click(checkboxFor(a3), { shiftKey: true });

      expect(lastSelection()).toEqual({ [a3.fingerprint]: true });
    });

    it("shift-click skips rows of a collapsed group", () => {
      renderHarness({
        alerts: [noInc1, inInc1, inInc2, otherInc1],
        groupBy: "incident",
      });
      expect(groupHeaderTexts()[1]).toContain("Checkout degraded");

      fireEvent.click(groupHeader("Checkout degraded"));
      fireEvent.click(checkboxFor(noInc1));
      fireEvent.click(checkboxFor(otherInc1), { shiftKey: true });

      expect(selectedIds()).toEqual(fingerprints(noInc1, otherInc1));
    });

    it("ticks every row of a group from its header checkbox, also when collapsed", () => {
      renderHarness({ alerts: [noInc1, noInc2, inInc1], groupBy: "incident" });
      const header = groupHeader("No incident");

      fireEvent.click(header);
      expect(rowFor(noInc1)).toBeNull();
      fireEvent.click(within(header).getByRole("checkbox"));

      expect(selectedIds()).toEqual(fingerprints(noInc1, noInc2));
    });

    it("unticks every row of a fully ticked group from its header checkbox", () => {
      renderHarness({
        alerts: [noInc1, noInc2, inInc1],
        groupBy: "incident",
        initial: {
          [noInc1.fingerprint]: true,
          [noInc2.fingerprint]: true,
          [inInc1.fingerprint]: true,
        },
      });
      const groupCheckbox = within(groupHeader("No incident")).getByRole(
        "checkbox"
      );
      expect(groupCheckbox).toBeChecked();
      expect(groupCheckbox).toHaveClass("quick-reveal");

      fireEvent.click(groupCheckbox);

      expect(lastSelection()).toEqual({ [inInc1.fingerprint]: true });
    });

    it("ticks the rest of a partially ticked group from its header checkbox", () => {
      renderHarness({
        alerts: [noInc1, noInc2, inInc1],
        groupBy: "incident",
        initial: { [noInc1.fingerprint]: true },
      });

      fireEvent.click(within(groupHeader("No incident")).getByRole("checkbox"));

      expect(selectedIds()).toEqual(fingerprints(noInc1, noInc2));
    });

    it("shows the group checkbox as some-selected when part of the group is ticked", () => {
      renderHarness({
        alerts: [noInc1, noInc2],
        groupBy: "incident",
        initial: { [noInc1.fingerprint]: true },
      });

      expect(
        (
          within(groupHeader("No incident")).getByRole(
            "checkbox"
          ) as HTMLInputElement
        ).indeterminate
      ).toBe(true);
    });

    it("marks the row whose dialog is open", () => {
      renderHarness({ alerts: [a1, a2], openFingerprint: a1.fingerprint });

      expect(rowFor(a1).querySelector("[data-quick-open]")).not.toBeNull();
      expect(rowFor(a2).querySelector("[data-quick-open]")).toBeNull();
    });

    it("does not save chrome columns or show them in the ⚙ panel", () => {
      const slot = document.createElement("div");
      document.body.appendChild(slot);
      const onChange = jest.fn();
      try {
        renderHarness({
          alerts: [alertWith({ service: "checkout" })],
          isEditMode: true,
          onChange,
          settingsSlot: slot,
        });

        expect(headerIds()).not.toContain("checkbox");
        expect(headerIds()).not.toContain("alertMenu");
        fireEvent.click(
          slot.querySelector(
            '[data-cy="dashboard-widget-table-settings-btn"]'
          ) as HTMLElement
        );
        const columnIds = Array.from(
          document.querySelectorAll("[data-table-settings-column]")
        ).map((row) => row.getAttribute("data-table-settings-column"));
        expect(columnIds).toContain("description");
        expect(columnIds).not.toContain("checkbox");
        expect(columnIds).not.toContain("alertMenu");

        fireEvent.click(screen.getByRole("checkbox", { name: "Description" }));

        expect(onChange).toHaveBeenCalledTimes(1);
        const saved = JSON.stringify(onChange.mock.calls[0][0]);
        expect(saved).not.toContain('"checkbox"');
        expect(saved).not.toContain('"alertMenu"');
      } finally {
        slot.remove();
      }
    });

    it("keeps the table exactly as wide as the widget with the gutter", () => {
      const widthOf = (columnId: string) =>
        Number.parseFloat(
          (
            screen
              .getByTestId(`header-cell-${columnId}`)
              .closest("th") as HTMLElement
          ).style.width
        );

      observeWidth(1200);
      renderHarness({ alerts: [a1] });

      expect(
        (widgetRoot().querySelector("table") as HTMLTableElement).style.width
      ).toBe("1200px");
      expect(widthOf("checkbox")).toBe(28);
      expect(widthOf("alertMenu")).toBe(0);
      expect(headerIds().reduce((sum, id) => sum + widthOf(id), 0)).toBe(1200);
    });
  });
});
