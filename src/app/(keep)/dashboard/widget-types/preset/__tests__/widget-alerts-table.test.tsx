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
import { useConfig } from "@/utils/hooks/useConfig";
import { RINGING_REASON } from "@/widgets/alerts-table/lib/alert-ringing";

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
      .filter((column) => {
        const hasAccessor =
          ("accessorFn" in column && column.accessorFn !== undefined) ||
          ("accessorKey" in column && column.accessorKey !== undefined);
        const hasValue = hasAccessor || column.getGroupingValue !== undefined;
        return !hasValue || column.enableGrouping === false;
      })
      .map((column) => column.id as string);

    expect([...cannotGroup].sort()).toEqual(
      [...WIDGET_UNGROUPABLE_COLUMN_IDS].sort()
    );
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

  describe("links inside the table", () => {
    const seenByLeaveGuard: boolean[] = [];
    const recordLikeLeaveGuard = (event: MouseEvent) => {
      seenByLeaveGuard.push(event.defaultPrevented);
      event.preventDefault();
    };

    beforeEach(() => {
      seenByLeaveGuard.length = 0;
      document.addEventListener("click", recordLikeLeaveGuard, true);
    });

    afterEach(() => {
      document.removeEventListener("click", recordLikeLeaveGuard, true);
    });

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

    it("a link in a cell navigates in view mode", () => {
      renderWidget(item, alerts());

      fireEvent.click(linkIn("incident"));
      fireEvent.click(linkIn("runbook"));

      expect(seenByLeaveGuard).toEqual([false, false]);
    });

    it("no link in a cell navigates in edit mode, before the leave guard sees the click", () => {
      renderWidget(item, alerts(), { isEditMode: true, onChange: jest.fn() });

      expect(linkIn("incident")).toHaveAttribute("href", "/incidents/i1");
      fireEvent.click(linkIn("incident"));
      fireEvent.click(linkIn("runbook"));

      expect(seenByLeaveGuard).toEqual([true, true]);
    });

    it("links stop navigating on entering edit mode and navigate again after it", () => {
      const data = alerts();
      const { rerender } = renderWidget(item, data);
      rerender(widget(item, data, { isEditMode: true, onChange: jest.fn() }));
      fireEvent.click(linkIn("incident"));
      rerender(widget(item, data));
      fireEvent.click(linkIn("incident"));

      expect(seenByLeaveGuard).toEqual([true, false]);
    });

    it("leaves links outside the widget and buttons inside it alone in edit mode", () => {
      renderWidget(
        { ...item, alertTable: { groupBy: "incident" } },
        alerts(),
        { isEditMode: true, onChange: jest.fn() }
      );
      const outside = document.createElement("a");
      outside.href = "/alerts/feed";
      document.body.appendChild(outside);

      fireEvent.click(outside);
      fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));

      expect(seenByLeaveGuard).toEqual([false, false]);
      expect(bodyRows()).toHaveLength(0);
      outside.remove();
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
});

describe("WidgetAlertsTable ringing rows", () => {
  const BLINK = "motion-safe:animate-missing-blink";
  const STEADY = "motion-reduce:bg-[color:var(--blink-soft)]";

  const ringingAlerts = () => [
    alertWith({ severity: Severity.Critical, service: "checkout" }),
    alertWith({ severity: 5, service: "checkout" }),
    alertWith({ severity: Severity.Critical, status: Status.Resolved }),
    alertWith({ severity: Severity.High, service: "checkout" }),
  ];

  const renderRinging = (
    presetNoisy: boolean | undefined,
    overrides: Partial<WidgetData> = {},
    alerts: AlertDto[] = ringingAlerts()
  ) => {
    render(
      <WidgetAlertsTable
        item={{
          ...baseItem,
          presetColumns: ["severity", "status", "source", "name"],
          ...overrides,
        }}
        alerts={alerts}
        background="rgb(16, 185, 129, 0.1)"
        presetNoisy={presetNoisy}
        isEditMode={false}
      />
    );
    return alerts;
  };

  const rowOf = (alert: AlertDto) =>
    document.querySelector(
      `[data-cy="alerts-row"][data-cy-id="${alert.fingerprint}"]`
    ) as HTMLElement;

  it("keeps the blink on the widget's plain rows, in every cell", () => {
    const [critical, numericCritical] = renderRinging(true);

    for (const alert of [critical, numericCritical]) {
      const row = rowOf(alert);
      expect(row).toHaveAttribute("data-ringing", "true");
      expect(row).toHaveClass(BLINK, STEADY);
      expect(row).not.toHaveClass("cursor-pointer");
      expect(row.style.getPropertyValue("--blink-strong")).not.toBe("");
      expect(within(row).getByText(RINGING_REASON)).toHaveClass("sr-only");
      const cells = row.querySelectorAll("td");
      expect(cells).toHaveLength(4);
      cells.forEach((cell) => expect(cell).toHaveClass("!bg-inherit"));
    }
  });

  it("leaves resolved and non-critical rows as they were", () => {
    const [, , resolved, high] = renderRinging(true);

    for (const alert of [resolved, high]) {
      const row = rowOf(alert);
      expect(row).not.toHaveAttribute("data-ringing");
      expect(row).not.toHaveClass(BLINK);
      expect(row.getAttribute("style")).toBeNull();
      expect(within(row).queryByText(RINGING_REASON)).toBeNull();
      row
        .querySelectorAll("td")
        .forEach((cell) => expect(cell).not.toHaveClass("!bg-inherit"));
    }
  });

  it.each([false, undefined])(
    "rings nothing when the preset's noisy flag is %s",
    (presetNoisy) => {
      renderRinging(presetNoisy);

      expect(document.querySelector("[data-ringing]")).toBeNull();
      expect(
        document.querySelector(".motion-safe\\:animate-missing-blink")
      ).toBeNull();
      expect(screen.queryByText(RINGING_REASON)).toBeNull();
    }
  );

  it("rings the child rows of a grouped widget, not the group headers", () => {
    const [critical, numericCritical, , high] = renderRinging(true, {
      alertTable: { groupBy: "service" },
    });

    expect(groupHeaders().length).toBeGreaterThan(0);
    groupHeaders().forEach((header) =>
      expect(header).not.toHaveAttribute("data-ringing")
    );
    expect(rowOf(critical)).toHaveAttribute("data-ringing", "true");
    expect(rowOf(numericCritical)).toHaveClass(BLINK);
    expect(rowOf(high)).not.toHaveAttribute("data-ringing");
  });

  it("lets a ringing row's pinned cells pulse with the row instead of the opaque tint", () => {
    const [critical, , , high] = renderRinging(true);

    expect(widgetRoot()).toHaveClass(
      "[&_td.sticky]:[background:var(--widget-opaque-bg)]",
      "[&_tr[data-ringing]_td.sticky]:[background:inherit]"
    );
    const pinned = within(rowOf(critical)).getAllByRole("cell").slice(0, 3);
    pinned.forEach((cell) => expect(cell).toHaveClass("sticky", "!bg-inherit"));
    expect(
      rowOf(high).querySelector('[data-cy="alerts-cell-severity"]')
    ).not.toHaveClass("!bg-inherit");
  });

  it("starts every ringing row's pulse at the page's time zero", () => {
    const synced: Element[] = [];
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: function (this: HTMLElement) {
        const element = this;
        return [
          {
            set startTime(value: number) {
              if (value === 0) {
                synced.push(element);
              }
            },
          },
        ];
      },
    });
    try {
      const [critical, numericCritical, , high] = renderRinging(true);

      expect(synced).toContain(rowOf(critical));
      expect(synced).toContain(rowOf(numericCritical));
      expect(synced).not.toContain(rowOf(high));
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
    }
  });
});
