import React from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { format } from "date-fns";
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

jest.mock("react-icons/md", () => jest.requireActual("react-icons/md"));

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

  describe("a saved snake_case alias resolves the same with or without loaded alerts", () => {
    const item = {
      presetColumns: ["name", "firing_counter", "description"],
      alertTable: {
        columnRenameMapping: { firingCounter: "Fires" },
        columnSizing: { firingCounter: 240 },
        columnOrder: ["firingCounter", "name", "description"],
        groupBy: "firing_counter",
      },
    };
    const header = (columnId: string) =>
      screen.getByTestId(`header-cell-${columnId}`);
    const expectResolved = () => {
      expect(headerIds()).toEqual(["firingCounter", "name", "description"]);
      expect(header("firingCounter")).toHaveTextContent("Fires");
      expect(
        (header("firingCounter").closest("th") as HTMLElement).style.width
      ).toBe("240px");
      expect(screen.getByText("Rows grouped by Fires")).toBeInTheDocument();
    };

    it("with alerts carrying firingCounter", () => {
      renderWidget(item, [
        alertWith({ firingCounter: 3 }),
        alertWith({ firingCounter: 3 }),
      ]);

      expectResolved();
      expect(groupHeaderTexts()).toEqual(["3 2 shown"]);
    });

    it("after a refresh that loads no alerts", () => {
      const { rerender } = renderWidget(item, [
        alertWith({ firingCounter: 3 }),
      ]);
      rerender(widget(item, []));

      expectResolved();
    });

    it("with alerts that lack the field, rendering empty cells", () => {
      renderWidget(
        { ...item, alertTable: { ...item.alertTable, groupBy: undefined } },
        [alertWith(), alertWith()]
      );

      expect(headerIds()).toEqual(["firingCounter", "name", "description"]);
      expect(header("firingCounter")).toHaveTextContent("Fires");
      expect(cellsOf("firingCounter").map((cell) => cell.textContent)).toEqual([
        "",
        "",
      ]);
    });

    it("keeps a dotted id and a custom snake_case enrichment key as they are", () => {
      renderWidget(
        { presetColumns: ["name", "labels.team_name", "my_custom_field"] },
        [alertWith({ labels: { team_name: "core" }, my_custom_field: "x" })]
      );

      expect(headerIds()).toEqual([
        "name",
        "labels.team_name",
        "my_custom_field",
      ]);
      expect(cellsOf("labels.team_name")[0]).toHaveTextContent("core");
      expect(cellsOf("my_custom_field")[0]).toHaveTextContent("x");
    });
  });

  describe("generated column cells", () => {
    const cellText = (columnId: string) =>
      cellsOf(columnId).map((cell) => cell.textContent);

    it("a date column renders empty, without throwing, for an alert that lacks the field", () => {
      renderWidget({ presetColumns: ["name", "createdAt"] }, [
        alertWith({ createdAt: "2026-10-01T10:00:00Z" }),
        alertWith(),
      ]);

      const [present, missing] = cellsOf("createdAt");
      expect(present.querySelector("span")).toHaveAttribute(
        "title",
        "2026-10-01T10:00:00.000Z"
      );
      expect(missing).toHaveTextContent(/^$/);
    });

    it("a date column renders empty for an invalid date or null", () => {
      renderWidget({ presetColumns: ["name", "firingStartTime"] }, [
        alertWith({ firingStartTime: "not a date" }),
        alertWith({ firingStartTime: null }),
        alertWith({ firingStartTime: "" }),
      ]);

      expect(cellText("firingStartTime")).toEqual(["", "", ""]);
    });

    it("Last Received truncates inside its cell, keeping the full text and the ISO title", () => {
      renderWidget({ presetColumns: ["name", "lastReceived"] }, [
        alertWith({ lastReceived: "2026-10-01T10:00:00Z" }),
      ]);

      const span = cellsOf("lastReceived")[0].querySelector("span")!;
      expect(span).toHaveClass("block", "truncate");
      expect(span.textContent).toMatch(/ ago$/);
      expect(span).toHaveAttribute("title", "2026-10-01T10:00:00.000Z");
    });

    it("a valid date renders through the shared renderer, with its ISO title", () => {
      renderWidget({ presetColumns: ["name", "updatedAt"] }, [
        alertWith({ updatedAt: "2026-10-01T10:00:00Z" }),
      ]);

      const span = cellsOf("updatedAt")[0].querySelector("span");
      expect(span).toHaveAttribute("title", "2026-10-01T10:00:00.000Z");
      expect(span?.textContent).toMatch(/ago$/);
    });

    it("a saved unresolved_counter shows a zero unresolvedCounter as 0, in the shared markup", () => {
      renderWidget({ presetColumns: ["name", "unresolved_counter"] }, [
        alertWith({ unresolvedCounter: 0 }),
        alertWith({ unresolvedCounter: 4 }),
      ]);

      expect(headerIds()).toEqual(["name", "unresolvedCounter"]);
      expect(cellText("unresolvedCounter")).toEqual(["0", "4"]);
      expect(
        cellsOf("unresolvedCounter")[0].querySelector("div.select-text")
      ).toHaveTextContent("0");
    });

    it("false renders as false", () => {
      renderWidget({ presetColumns: ["name", "acknowledged"] }, [
        alertWith({ acknowledged: false }),
        alertWith({ acknowledged: true }),
      ]);

      expect(cellText("acknowledged")).toEqual(["false", "true"]);
    });

    it("null, undefined and an empty string render empty", () => {
      renderWidget({ presetColumns: ["name", "team"] }, [
        alertWith({ team: null }),
        alertWith({ team: undefined }),
        alertWith({ team: "" }),
        alertWith({ team: "core" }),
      ]);

      expect(cellText("team")).toEqual(["", "", "", "core"]);
    });
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

    it.each(["alert_rule_url", "runbook_url"])(
      "opens %s at 72px and keeps its 44px minimum",
      (columnId) => {
        const { result } = renderHook(() =>
          useWidgetAlertColumns({
            item: {
              ...baseItem,
              presetColumns: ["name", "alert_rule_url", "runbook_url"],
            },
            alerts: [alertWith()],
            presetName: "link-start-size",
          })
        );
        const column = result.current.columns.find(
          (candidate) => candidate.id === columnId
        )!;

        expect([column.size, column.minSize]).toEqual([72, 44]);
      }
    );

    it("renders the rule and runbook columns at 72px, and a saved width wins", () => {
      const presetColumns = ["name", "alert_rule_url", "runbook_url"];
      const { unmount } = renderWidget({ presetColumns });

      expect(widthOf("alert_rule_url")).toBe("72px");
      expect(widthOf("runbook_url")).toBe("72px");
      unmount();

      renderWidget({
        presetColumns,
        alertTable: { columnSizing: { runbook_url: 50 } },
      });
      expect(widthOf("runbook_url")).toBe("50px");
    });

    describe("link column headers at a scaled text size", () => {
      const presetColumns = ["name", "alert_rule_url", "runbook_url"];
      const JSDOM_BUTTON_PADDING_PX = 12;
      const mockRunbookLabelWidth = (width: number) =>
        jest
          .spyOn(HTMLElement.prototype, "scrollWidth", "get")
          .mockImplementation(function (this: HTMLElement) {
            return this.tagName === "SPAN" && this.textContent === "Runbook"
              ? width
              : 0;
          });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it("opens a link column at its header label plus padding and 1px, past 72px", () => {
        mockRunbookLabelWidth(104);
        renderWidget({ presetColumns });

        expect(widthOf("runbook_url")).toBe(
          `${104 + JSDOM_BUTTON_PADDING_PX + 1}px`
        );
        expect(widthOf("alert_rule_url")).toBe("72px");
      });

      it("keeps 72px for a header that fits", () => {
        mockRunbookLabelWidth(50);
        renderWidget({ presetColumns });

        expect(widthOf("runbook_url")).toBe("72px");
      });

      it("makes room for the header's edit-mode menu", () => {
        const MENU_WIDTH = 37;
        mockRunbookLabelWidth(104);
        const original = HTMLElement.prototype.getBoundingClientRect;
        jest
          .spyOn(HTMLElement.prototype, "getBoundingClientRect")
          .mockImplementation(function (this: HTMLElement) {
            const header = this.parentElement;
            const isRunbookMenu =
              header?.dataset.cy === "alerts-header-runbook_url" &&
              !this.querySelector("span") &&
              !this.dataset.testid?.startsWith("drag-handle-");
            return isRunbookMenu
              ? ({ width: MENU_WIDTH, height: 16, top: 0, left: 0, right: MENU_WIDTH, bottom: 16 } as DOMRect)
              : original.call(this);
          });
        renderWidget({ presetColumns }, undefined, {
          isEditMode: true,
          onChange: jest.fn(),
        });

        expect(widthOf("runbook_url")).toBe(
          `${104 + JSDOM_BUTTON_PADDING_PX + MENU_WIDTH + 1}px`
        );
      });

      it("keeps a saved width", () => {
        mockRunbookLabelWidth(104);
        renderWidget({
          presetColumns,
          alertTable: { columnSizing: { runbook_url: 50 } },
        });

        expect(widthOf("runbook_url")).toBe("50px");
      });
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

      it("widening the flex column keeps its saved width exact and scrolls, instead of snapping it narrower", () => {
        const item = {
          presetColumns: ["name", "description", "lastReceived"],
        };
        observeWidth(1600);
        const { unmount } = renderWidget(item);
        expect(renderedWidths()).toEqual({
          name: 100,
          description: 1420,
          lastReceived: 80,
        });
        unmount();

        renderWidget({
          ...item,
          alertTable: { columnSizing: { description: 1440 } },
        });

        expect(renderedWidths()).toEqual({
          name: 100,
          description: 1440,
          lastReceived: 80,
        });
        expect(tableElement().style.width).toBe("1620px");
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

  describe("a saved groupBy the table cannot group by", () => {
    const item = {
      presetColumns: ["name", "description"],
      alertTable: { groupBy: "enriched_fields" },
    };
    const alerts = () => [
      alertWith({ enriched_fields: ["a"], description: "disk" }),
      alertWith({ enriched_fields: ["b"], description: "cpu" }),
    ];
    const openHeaderMenu = async (columnId: string) => {
      const cell = screen.getByTestId(`header-cell-${columnId}`);
      const trigger = within(cell).getByTestId("dropdown-menu-button");
      fireEvent.mouseDown(trigger);
      fireEvent.click(trigger);
      await screen.findByTestId("dropdown-menu-list");
    };
    const lastEmitted = (onChange: jest.Mock): WidgetData =>
      onChange.mock.calls[onChange.mock.calls.length - 1][0];

    const groupByDescription = async () => {
      const onChange = jest.fn();
      const data = alerts();
      const view = renderWidget(item, data, { isEditMode: true, onChange });
      expect(groupHeaders()).toHaveLength(0);

      await openHeaderMenu("description");
      fireEvent.click(screen.getByText("Group by"));

      expect(onChange).toHaveBeenCalledTimes(1);
      const grouped = lastEmitted(onChange);
      view.rerender(widget(grouped, data, { isEditMode: true, onChange }));
      return { onChange, grouped, data, view };
    };

    it("header Group by on another column replaces it, and the table groups by that column", async () => {
      const { grouped } = await groupByDescription();

      expect(grouped.alertTable?.groupBy).toBe("description");
      expect(groupHeaderTexts()).toEqual(["disk 1 shown", "cpu 1 shown"]);
    });

    it("header Ungroup then clears the new grouping", async () => {
      const { onChange } = await groupByDescription();

      await openHeaderMenu("description");
      fireEvent.click(screen.getByText("Ungroup"));

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(lastEmitted(onChange).alertTable?.groupBy).toBeUndefined();
    });

    it("the grouping chip then clears the new grouping", async () => {
      const { onChange } = await groupByDescription();

      fireEvent.click(screen.getByRole("button", { name: "Clear grouping" }));

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(lastEmitted(onChange).alertTable?.groupBy).toBeUndefined();
    });
  });

  it("header Rename starts from the name the header shows", async () => {
    renderWidget(
      { presetColumns: ["name", "description"] },
      [alertWith()],
      { isEditMode: true, onChange: jest.fn() }
    );
    expect(
      within(screen.getByTestId("header-cell-name")).getByText("Alert name")
    ).toBeInTheDocument();

    const cell = screen.getByTestId("header-cell-name");
    const trigger = within(cell).getByTestId("dropdown-menu-button");
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    await screen.findByTestId("dropdown-menu-list");
    const rename = screen.getByText("Rename column");
    fireEvent.pointerEnter(rename);
    fireEvent.mouseMove(rename);

    expect(await screen.findByDisplayValue("Alert name")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Name")).toBeNull();
  });

  it("labels node_name and host columns differently", () => {
    renderWidget({ presetColumns: ["name", "node_name", "host"] }, [
      alertWith({ node_name: "db-1" }),
    ]);
    expect(
      within(screen.getByTestId("header-cell-node_name")).getByText(
        "Node Name"
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("header-cell-host")).getByText("Host")
    ).toBeInTheDocument();
    expect(screen.getByText("db-1")).toBeInTheDocument();
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

  it("a widget saved Relaxed renders relaxed rows whatever the viewer's row style", () => {
    localStorage.setItem(
      "keephq-alert-table-row-style",
      JSON.stringify("default")
    );

    renderWidget({
      presetColumns: ["name", "description"],
      alertTable: { rowStyle: "relaxed" },
    });

    expect(bodyRows()).toHaveLength(2);
    bodyRows().forEach((row) => {
      expect(row).toHaveClass("h-12");
      expect(row).not.toHaveClass("h-8");
    });
    expect(cellsOf("description")).toHaveLength(2);
    cellsOf("description").forEach((cell) => {
      expect(cell.querySelector(".line-clamp-3")).not.toBeNull();
      expect(cell.querySelector(".line-clamp-1")).toBeNull();
    });
  });

  it("an unknown saved row style renders compact rows", () => {
    renderWidget({
      presetColumns: ["name", "description"],
      alertTable: { rowStyle: "comfortable" as never },
    });

    expect(bodyRows()).toHaveLength(2);
    bodyRows().forEach((row) => {
      expect(row).toHaveClass("h-8");
      expect(row).not.toHaveClass("h-12");
    });
  });

  describe("column formats", () => {
    const savedDate = format(new Date("2026-10-01T10:00:00Z"), "PP");
    const exactly = (text: string) => new RegExp(`^${text}$`);
    const openHeaderMenu = async (columnId: string) => {
      const cell = screen.getByTestId(`header-cell-${columnId}`);
      const trigger = within(cell).getByTestId("dropdown-menu-button");
      fireEvent.mouseDown(trigger);
      fireEvent.click(trigger);
      await screen.findByTestId("dropdown-menu-list");
    };
    const pickTimeFormat = async (columnId: string, label: string) => {
      await openHeaderMenu(columnId);
      const formatTime = screen.getByText("Format time");
      fireEvent.pointerEnter(formatTime);
      fireEvent.mouseMove(formatTime);
      fireEvent.click(await screen.findByText(label));
    };
    const pickListFormat = async (columnId: string, label: string) => {
      await openHeaderMenu(columnId);
      const formatList = screen.getByText("Format list");
      fireEvent.pointerEnter(formatList);
      fireEvent.mouseMove(formatList);
      fireEvent.click(await screen.findByText(label));
    };

    it("a saved time format renders in that format", () => {
      renderWidget({
        presetColumns: ["name", "lastReceived"],
        alertTable: { columnTimeFormats: { lastReceived: "date" } },
      });

      const cells = cellsOf("lastReceived");
      expect(cells).toHaveLength(2);
      cells.forEach((cell) =>
        expect(cell).toHaveTextContent(exactly(savedDate))
      );
    });

    it("Format time in the edit-mode header menu saves the column's format", async () => {
      const onChange = jest.fn();
      renderWidget({ presetColumns: ["name", "lastReceived"] }, undefined, {
        isEditMode: true,
        onChange,
      });

      await pickTimeFormat(
        "lastReceived",
        "Relative format (e.g. Today at 12:30 PM)"
      );

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].alertTable.columnTimeFormats).toEqual({
        lastReceived: "relative",
      });
    });

    it("choosing Time ago on an unformatted column saves nothing", async () => {
      const onChange = jest.fn();
      renderWidget({ presetColumns: ["name", "lastReceived"] }, undefined, {
        isEditMode: true,
        onChange,
      });

      await pickTimeFormat("lastReceived", "Time ago (e.g. 5 minutes ago)");

      expect(onChange).not.toHaveBeenCalled();
    });

    it("a saved list format renders in that format", () => {
      const tags = JSON.stringify(["a", "b", "c"]);
      renderWidget(
        {
          presetColumns: ["name", "tags"],
          alertTable: { columnListFormats: { tags: "count" } },
        },
        [alertWith({ tags }), alertWith({ tags })]
      );

      const cells = cellsOf("tags");
      expect(cells).toHaveLength(2);
      cells.forEach((cell) =>
        expect(within(cell as HTMLElement).getByText("3")).toBeInTheDocument()
      );
    });

    it("Format list in the edit-mode header menu saves the column's format", async () => {
      const onChange = jest.fn();
      const tags = JSON.stringify(["a", "b", "c"]);
      renderWidget(
        { presetColumns: ["name", "tags"] },
        [alertWith({ tags }), alertWith({ tags })],
        { isEditMode: true, onChange }
      );

      await pickListFormat("tags", "Count only (show number of items)");

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].alertTable.columnListFormats).toEqual({
        tags: "count",
      });
    });

    it("choosing Badges on an unformatted list column saves nothing", async () => {
      const onChange = jest.fn();
      const tags = JSON.stringify(["a", "b", "c"]);
      renderWidget(
        { presetColumns: ["name", "tags"] },
        [alertWith({ tags }), alertWith({ tags })],
        { isEditMode: true, onChange }
      );

      await pickListFormat("tags", "Badges (colored items with details)");

      expect(onChange).not.toHaveBeenCalled();
    });

    it("an array-valued column's header menu offers no Format list", async () => {
      renderWidget(
        { presetColumns: ["name", "enriched_fields"] },
        [
          alertWith({ enriched_fields: ["a", "b"] }),
          alertWith({ enriched_fields: ["a", "b"] }),
        ],
        { isEditMode: true, onChange: jest.fn() }
      );

      await openHeaderMenu("enriched_fields");

      expect(screen.getByText(/rename column/i)).toBeInTheDocument();
      expect(screen.queryByText("Format list")).toBeNull();
    });

    it("a saved format on a missing generated date renders an empty cell", () => {
      expect(() =>
        renderWidget(
          {
            presetColumns: ["name", "firingStartTime"],
            alertTable: { columnTimeFormats: { firingStartTime: "iso" } },
          },
          [alertWith({ firingStartTime: undefined })]
        )
      ).not.toThrow();

      const cells = cellsOf("firingStartTime");
      expect(cells).toHaveLength(1);
      expect(cells[0].textContent).toBe("");
    });

    it("a narrow widget applies saved Relaxed and formats with no header menu", () => {
      observeWidth(300);
      renderWidget(
        {
          presetColumns: ["name", "lastReceived"],
          alertTable: {
            rowStyle: "relaxed",
            columnTimeFormats: { lastReceived: "date" },
          },
        },
        undefined,
        { isEditMode: true, onChange: jest.fn() }
      );

      expect(bodyRows()).toHaveLength(2);
      bodyRows().forEach((row) => expect(row).toHaveClass("h-12"));
      cellsOf("lastReceived").forEach((cell) =>
        expect(cell).toHaveTextContent(exactly(savedDate))
      );
      expect(screen.queryAllByTestId("dropdown-menu-button")).toHaveLength(0);
    });

    it("view mode offers no header menu", () => {
      renderWidget({
        presetColumns: ["name", "lastReceived"],
        alertTable: { columnTimeFormats: { lastReceived: "date" } },
      });

      expect(screen.queryAllByTestId("dropdown-menu-button")).toHaveLength(0);
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

    it("choosing Relaxed in the panel saves the row style and the table turns relaxed", () => {
      const onChange = jest.fn();
      const alerts = [alertWith(), alertWith()];
      const { rerender } = renderWithSlot(
        { presetColumns: ["name", "description"] },
        { isEditMode: true, onChange },
        alerts
      );
      bodyRows().forEach((row) => expect(row).toHaveClass("h-8"));

      fireEvent.click(settingsButton() as HTMLElement);
      fireEvent.click(screen.getByRole("radio", { name: "Relaxed" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const relaxed: WidgetData = onChange.mock.calls[0][0];
      expect(relaxed.alertTable).toEqual({ rowStyle: "relaxed" });
      expect(relaxed.presetColumns).toEqual(["name", "description"]);

      rerender(
        <WidgetAlertsTable
          item={relaxed}
          alerts={alerts}
          isEditMode
          onChange={onChange}
          settingsSlot={slot}
        />
      );

      expect(bodyRows()).toHaveLength(2);
      bodyRows().forEach((row) => {
        expect(row).toHaveClass("h-12");
        expect(row).not.toHaveClass("h-8");
      });
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

    it("Group rows by replaces a saved groupBy the table cannot group by", async () => {
      const onChange = jest.fn();
      renderWithSlot(
        { alertTable: { groupBy: "enriched_fields" } },
        { isEditMode: true, onChange },
        [alertWith({ enriched_fields: ["a"], service: "checkout" })]
      );

      fireEvent.click(settingsButton() as HTMLElement);
      fireEvent.click(
        screen.getByRole("button", { name: "Show Group rows by options" })
      );
      const listbox = await screen.findByRole("listbox");
      fireEvent.mouseDown(
        within(listbox).getByRole("option", { name: "Service" })
      );

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].alertTable.groupBy).toBe("service");
    });

    it("does not offer a list field in Group rows by, even as a visible column", async () => {
      renderWithSlot(
        { presetColumns: ["name", "enriched_fields", "region"] },
        { isEditMode: true, onChange: jest.fn() },
        [alertWith({ enriched_fields: ["a"], region: "eu" })]
      );

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

    it("Group rows by offers a groupable alert field that is not a column, and the table groups by it", async () => {
      const onChange = jest.fn();
      const alerts = [
        alertWith({ environment: "prod" }),
        alertWith({ environment: "staging" }),
        alertWith({ environment: "prod" }),
      ];
      const { rerender } = renderWithSlot(
        { presetColumns: ["name"] },
        { isEditMode: true, onChange },
        alerts
      );
      expect(headerIds()).not.toContain("environment");

      fireEvent.click(settingsButton() as HTMLElement);
      fireEvent.click(
        screen.getByRole("button", { name: "Show Group rows by options" })
      );
      fireEvent.mouseDown(
        within(await screen.findByRole("listbox")).getByRole("option", {
          name: "environment",
        })
      );

      expect(onChange).toHaveBeenCalledTimes(1);
      const grouped: WidgetData = onChange.mock.calls[0][0];
      expect(grouped.alertTable?.groupBy).toBe("environment");
      expect(grouped.presetColumns).toEqual(["name"]);

      rerender(
        <WidgetAlertsTable
          item={grouped}
          alerts={alerts}
          isEditMode={false}
          settingsSlot={slot}
        />
      );

      expect(headerIds()).toEqual(["name"]);
      expect(groupHeaderTexts()).toEqual(["prod 2 shown", "staging 1 shown"]);
    });

    it("groups by a groupable alert field no loaded alert carries, in one empty group", () => {
      renderWithSlot(
        { presetColumns: ["name"], alertTable: { groupBy: "ticket_status" } },
        { isEditMode: false },
        [alertWith(), alertWith()]
      );

      expect(headerIds()).toEqual(["name"]);
      expect(groupHeaderTexts()).toEqual(["No Ticket Status 2 shown"]);
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

      it("a typed width writes alertTable.columnSizing once per commit, not capped at the maximum", () => {
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
          name: 2500,
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

    const pinnedHeader = screen
      .getByTestId("header-cell-severity")
      .closest("th") as HTMLElement;
    expect(pinnedHeader).toHaveClass("sticky");
    expect(pinnedHeader.style.zIndex).toBe("1");
    expect(widgetRoot()).toHaveClass("[&_th.sticky]:!z-40");
  });

  it("gives every pinned cell, header and body, the same z-index so DOM order decides among them", () => {
    renderWidget();

    expect(widgetRoot()).toHaveClass("[&_th.sticky]:!z-40", "[&_td.sticky]:!z-40");
    expect(cellsOf("severity")[0]).toHaveClass("sticky");
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
      presetColumns?: string[];
    };

    function Harness({
      alerts = [a1],
      groupBy,
      isEditMode = false,
      onChange,
      settingsSlot,
      initial = {},
      openFingerprint = null,
      presetColumns,
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
              ...(presetColumns ? { presetColumns } : {}),
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

    describe("rule and runbook icon links", () => {
      const ruleAlert = alertWith({
        alert_rule_url:
          "https://grafana-olly.com/alerting/grafana/aef3k2pq/view?orgId=1",
        runbook_url: "https://wiki.ops.internal/runbooks/high-cpu-usage",
      });
      const presetColumns = ["name", "alert_rule_url", "runbook_url"];

      it("renders the Grafana icon link under a Rule header, and a click leaves the row alone", () => {
        renderHarness({ alerts: [ruleAlert], presetColumns });

        expect(screen.getByTestId("header-cell-alert_rule_url")).toHaveTextContent(
          /^Rule$/
        );
        expect(screen.getByTestId("header-cell-runbook_url")).toHaveTextContent(
          /^Runbook$/
        );
        const link = screen.getByRole("link", {
          name: "Open alert rule in Grafana",
        });
        const reachedDocument = jest.fn((event: Event) => event.preventDefault());
        document.addEventListener("click", reachedDocument);
        fireEvent.click(link);
        document.removeEventListener("click", reachedDocument);

        expect(reachedDocument).not.toHaveBeenCalled();
        expect(onRowSelectionChange).not.toHaveBeenCalled();
        expect(onOpenAction).not.toHaveBeenCalled();
      });

      it("renders the icons dimmed and without links in edit mode", () => {
        renderHarness({ alerts: [ruleAlert], presetColumns, isEditMode: true });

        expect(screen.queryByRole("link")).toBeNull();
        expect(
          cellsOf("alert_rule_url")[0].querySelector('[aria-disabled="true"]')
        ).not.toBeNull();
      });
    });

    describe("tray placement", () => {
      const trayOf = (alert: AlertDto) =>
        rowFor(alert).querySelector<HTMLElement>(".quick-tray");
      const rect = (top: number, bottom: number) =>
        ({ top, bottom, left: 0, right: 600, width: 600, height: bottom - top }) as DOMRect;

      const clipWith = (
        element: HTMLElement,
        top: number,
        bottom: number,
        overflows: boolean
      ) => {
        element.style.overflowY = "auto";
        element.getBoundingClientRect = () => rect(top, bottom);
        Object.defineProperty(element, "clientHeight", {
          configurable: true,
          value: bottom - top,
        });
        Object.defineProperty(element, "scrollHeight", {
          configurable: true,
          value: bottom - top + (overflows ? 40 : 0),
        });
      };

      const renderInCard = ({
        cardTop = 0,
        cardBottom = 400,
        innerBottom = 400,
        innerOverflows = false,
      } = {}) => {
        const view = renderHarness({ alerts: [a1, a2] });
        view.container.setAttribute("data-cy", "dashboard-widget-preset");
        clipWith(view.container, cardTop, cardBottom, false);
        clipWith(widgetRoot(), 0, innerBottom, innerOverflows);
        rowFor(a1).getBoundingClientRect = () => rect(40, 72);
        rowFor(a2).getBoundingClientRect = () => rect(72, 104);
        [a1, a2].forEach((alert) => {
          trayOf(alert)!.getBoundingClientRect = () => rect(0, 28);
        });
      };
      const enter = (alert: AlertDto) =>
        act(() => {
          checkboxFor(alert).focus();
        });

      it("hangs the tray from the row's bottom edge, at its right end", () => {
        renderInCard();

        enter(a1);

        const tray = trayOf(a1)!;
        expect(tray).toHaveAttribute("data-placement", "below");
        expect(tray).toHaveClass("absolute", "right-1");
        expect(tray.closest("td")).toHaveAttribute("data-column-id", "alertMenu");
      });

      it("flips above the last visible row when the widget card clips, past a scroller that doesn't", () => {
        renderInCard({ cardBottom: 120, innerBottom: 400 });

        enter(a1);
        enter(a2);

        expect(trayOf(a1)).toHaveAttribute("data-placement", "below");
        expect(trayOf(a2)).toHaveAttribute("data-placement", "above");
      });

      it("flips above when an inner scroller that overflows clips the row", () => {
        renderInCard({ cardBottom: 400, innerBottom: 120, innerOverflows: true });

        enter(a2);

        expect(trayOf(a2)).toHaveAttribute("data-placement", "above");
      });

      it("flips above when an inner scroller clips the row, overflowing or not", () => {
        renderInCard({ cardBottom: 400, innerBottom: 120, innerOverflows: false });

        enter(a2);

        expect(trayOf(a2)).toHaveAttribute("data-placement", "above");
      });

      it("ignores ancestors whose vertical overflow is visible", () => {
        renderInCard({ cardBottom: 400, innerBottom: 120 });
        widgetRoot().style.overflowY = "visible";

        enter(a2);

        expect(trayOf(a2)).toHaveAttribute("data-placement", "below");
      });

      it("sits inside the row when neither below nor above fits, as in a 1-row widget", () => {
        renderInCard({ cardTop: 60, cardBottom: 120 });

        enter(a2);

        expect(trayOf(a2)).toHaveAttribute("data-placement", "inside");
      });

      describe("beside trailing link columns", () => {
        const linkAlert = alertWith({
          alert_rule_url: "https://grafana-olly.com/alerting/grafana/x/view",
          runbook_url: "https://wiki.ops.internal/runbooks/x",
        });
        const widthOfCells = (widths: Record<string, number>) =>
          rowFor(linkAlert)
            .querySelectorAll<HTMLElement>("td[data-column-id]")
            .forEach((cell) => {
              const width = widths[cell.dataset.columnId!] ?? 100;
              cell.getBoundingClientRect = () =>
                ({ ...rect(40, 72), width }) as DOMRect;
            });

        it("ends the tab where the trailing link columns start", () => {
          renderHarness({
            alerts: [linkAlert],
            presetColumns: ["name", "alert_rule_url", "runbook_url"],
          });
          widthOfCells({ alert_rule_url: 72, runbook_url: 96 });

          enter(linkAlert);

          expect(trayOf(linkAlert)!.style.right).toBe("168px");
        });

        it("keeps the tab at the row's right end without trailing link columns", () => {
          renderHarness({
            alerts: [linkAlert],
            presetColumns: ["name", "alert_rule_url", "runbook_url", "service"],
          });
          widthOfCells({ alert_rule_url: 72, runbook_url: 96 });

          enter(linkAlert);

          expect(trayOf(linkAlert)!.style.right).toBe("");
          expect(trayOf(linkAlert)).toHaveClass("right-1");
        });
      });

      it("places the tray in the same step that makes its row active", () => {
        jest.useFakeTimers();
        try {
          renderInCard({ cardBottom: 120 });
          const tray = trayOf(a2)!;
          rowFor(a2).firstElementChild!.dispatchEvent(
            new MouseEvent("pointerover", { bubbles: true })
          );

          expect(tray).not.toHaveAttribute("data-placement");
          jest.advanceTimersByTime(100);
          expect(rowFor(a2)).toHaveAttribute("data-quick-active");
          expect(tray).toHaveAttribute("data-placement", "above");
        } finally {
          jest.useRealTimers();
        }
      });

      it("renders no tray in edit mode", () => {
        renderHarness({ alerts: [a1, a2], isEditMode: true });

        expect(document.querySelector(".quick-tray")).toBeNull();
      });
    });

    describe("hover intent", () => {
      const rows5 = [alertWith(), alertWith(), alertWith(), alertWith(), alertWith()];
      const activeRows = () =>
        Array.from(document.querySelectorAll("tr[data-quick-active]"));
      const over = (element: Element) =>
        element.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
      const overRow = (alert: AlertDto) => over(rowFor(alert).firstElementChild!);
      const leaveWidget = () =>
        widgetRoot().dispatchEvent(new MouseEvent("pointerleave"));
      const wait = (ms: number) => jest.advanceTimersByTime(ms);
      const trayIn = (alert: AlertDto) =>
        rowFor(alert).querySelector<HTMLElement>(".quick-tray")!;

      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it("shows no tray during a sweep that spends under 100ms on each row", () => {
        renderHarness({ alerts: rows5 });

        rows5.forEach((alert) => {
          overRow(alert);
          wait(80);
          expect(activeRows()).toHaveLength(0);
        });
        over(widgetRoot());
        wait(200);
        expect(activeRows()).toHaveLength(0);
      });

      it("makes the row active after resting on it for 100ms, and only that row", () => {
        renderHarness({ alerts: rows5 });

        overRow(rows5[2]);
        wait(99);
        expect(activeRows()).toHaveLength(0);
        wait(1);

        expect(activeRows()).toEqual([rowFor(rows5[2])]);
      });

      it("hands over to the next row in one step, with no overlap", () => {
        renderHarness({ alerts: rows5 });
        overRow(rows5[0]);
        wait(100);

        overRow(rows5[1]);
        wait(99);
        expect(activeRows()).toEqual([rowFor(rows5[0])]);
        wait(1);

        expect(activeRows()).toEqual([rowFor(rows5[1])]);
        expect(rowFor(rows5[0])).not.toHaveAttribute("data-quick-leaving");
      });

      it("keeps the tray when the pointer crosses the next row on its way to the tab", () => {
        renderHarness({ alerts: rows5 });
        overRow(rows5[0]);
        wait(100);

        overRow(rows5[1]);
        wait(60);
        over(trayIn(rows5[0]).querySelector("button")!);
        wait(200);

        expect(activeRows()).toEqual([rowFor(rows5[0])]);
      });

      it("hides the tray 150ms after the pointer leaves the widget, with a fade", () => {
        renderHarness({ alerts: rows5 });
        overRow(rows5[3]);
        wait(100);

        leaveWidget();
        wait(149);
        expect(activeRows()).toEqual([rowFor(rows5[3])]);
        wait(1);

        expect(activeRows()).toHaveLength(0);
        expect(rowFor(rows5[3])).toHaveAttribute("data-quick-leaving");
      });

      it("clears the leaving mark once the fade is over, 250ms after the pointer left", () => {
        renderHarness({ alerts: rows5 });
        overRow(rows5[3]);
        wait(100);

        leaveWidget();
        wait(249);
        expect(rowFor(rows5[3])).toHaveAttribute("data-quick-leaving");
        wait(1);

        expect(rowFor(rows5[3])).not.toHaveAttribute("data-quick-leaving");
        expect(activeRows()).toHaveLength(0);
      });

      it("makes a fading row active again at once when the pointer comes back, without the mark", () => {
        renderHarness({ alerts: rows5 });
        overRow(rows5[3]);
        wait(100);
        leaveWidget();
        wait(200);

        overRow(rows5[3]);

        expect(activeRows()).toEqual([rowFor(rows5[3])]);
        expect(rowFor(rows5[3])).not.toHaveAttribute("data-quick-leaving");
        wait(300);
        expect(activeRows()).toEqual([rowFor(rows5[3])]);
        expect(rowFor(rows5[3])).not.toHaveAttribute("data-quick-leaving");
      });

      it("keeps the tray when the pointer comes back before the 150ms are up", () => {
        renderHarness({ alerts: rows5 });
        overRow(rows5[3]);
        wait(100);

        leaveWidget();
        wait(100);
        overRow(rows5[3]);
        wait(200);

        expect(activeRows()).toEqual([rowFor(rows5[3])]);
      });

      it("makes a row active at once on keyboard focus, and inactive when focus leaves the widget", () => {
        renderHarness({ alerts: rows5 });

        act(() => {
          checkboxFor(rows5[4]).focus();
        });
        expect(activeRows()).toEqual([rowFor(rows5[4])]);

        act(() => {
          (document.activeElement as HTMLElement).blur();
        });
        expect(activeRows()).toHaveLength(0);
      });

      it("leaves no timer running after unmount", () => {
        const { unmount } = renderHarness({ alerts: rows5 });
        overRow(rows5[0]);
        wait(100);
        overRow(rows5[1]);
        leaveWidget();

        unmount();

        expect(jest.getTimerCount()).toBe(0);
      });

      it("leaves no timer running after unmount mid-fade", () => {
        const { unmount } = renderHarness({ alerts: rows5 });
        overRow(rows5[0]);
        wait(100);
        leaveWidget();
        wait(160);

        unmount();

        expect(jest.getTimerCount()).toBe(0);
      });
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

    it("offers Link to incident on a row already in an incident", () => {
      renderHarness({ alerts: [inInc1] });

      fireEvent.click(
        screen.getByRole("button", {
          name: `Link to incident: ${inInc1.name}`,
        })
      );

      expect(onOpenAction).toHaveBeenCalledWith(
        "link-incident",
        [inInc1],
        null
      );
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

      expect(onOpenAction).toHaveBeenCalledWith("dismiss", [a1], null);
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

    describe("table width with the gutter", () => {
      const widthOf = (columnId: string) =>
        Number.parseFloat(
          (
            screen
              .getByTestId(`header-cell-${columnId}`)
              .closest("th") as HTMLElement
          ).style.width
        );
      const tableWidth = () =>
        (widgetRoot().querySelector("table") as HTMLTableElement).style.width;
      const totalWidth = () =>
        headerIds().reduce((sum, id) => sum + widthOf(id), 0);
      const widthsWithoutGutter = () => {
        const { unmount } = render(
          <WidgetAlertsTable item={baseItem} alerts={[a1]} isEditMode={false} />
        );
        const widths = {
          description: widthOf("description"),
          total: totalWidth(),
        };
        unmount();
        return widths;
      };

      it("keeps the table exactly as wide as the widget", () => {
        observeWidth(1200);
        renderHarness({ alerts: [a1] });

        expect(tableWidth()).toBe("1200px");
        expect(widthOf("checkbox")).toBe(28);
        expect(widthOf("alertMenu")).toBe(0);
        expect(totalWidth()).toBe(1200);
      });

      it("takes the gutter from description so a widget that fits without it never scrolls", () => {
        const plain = widthsWithoutGutter();

        observeWidth(plain.total);
        renderHarness({ alerts: [a1] });

        expect(widthOf("checkbox")).toBe(28);
        expect(widthOf("description")).toBe(plain.description - 28);
        expect(tableWidth()).toBe(`${plain.total}px`);
        expect(totalWidth()).toBe(plain.total);
      });

      it("scrolls no further than the same widget without the gutter", () => {
        const plain = widthsWithoutGutter();

        observeWidth(plain.total - 10);
        renderHarness({ alerts: [a1] });

        expect(widthOf("description")).toBe(plain.description - 28);
        expect(tableWidth()).toBe(`${plain.total}px`);
      });
    });
  });
});

describe("WidgetAlertsTable ringing rows", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
  });

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
  });

  const PULSE = "motion-safe:before:animate-ringing-pulse";
  const OVERLAY = [
    "isolate",
    "before:absolute",
    "before:inset-0",
    "before:-z-10",
    "before:pointer-events-none",
    "before:border-y-2",
    "before:bg-[color:var(--blink-row-tint)]",
    PULSE,
  ];

  const ringingAlerts = () => [
    alertWith({ severity: Severity.Critical, service: "checkout" }),
    alertWith({ severity: 5, service: "checkout" }),
    alertWith({ severity: "CRITICAL", status: "FIRING", service: "checkout" }),
    alertWith({ severity: Severity.Critical, status: Status.Resolved }),
    alertWith({ severity: Severity.High, service: "checkout" }),
    alertWith({ severity: Severity.Critical, deleted: true }),
  ];

  const renderRinging = (
    presetNoisy: boolean | undefined,
    overrides: Partial<WidgetData> = {},
    { isEditMode = false }: { isEditMode?: boolean } = {}
  ) => {
    const alerts = ringingAlerts();
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
        isEditMode={isEditMode}
        onChange={isEditMode ? jest.fn() : undefined}
      />
    );
    return alerts;
  };

  const rowOf = (alert: AlertDto) =>
    document.querySelector(
      `[data-cy="alerts-row"][data-cy-id="${alert.fingerprint}"]`
    ) as HTMLElement;

  const cellsOfRow = (alert: AlertDto) =>
    Array.from(rowOf(alert).querySelectorAll("td"));

  const expectQuiet = (alert: AlertDto) => {
    const row = rowOf(alert);
    expect(row).toBeInTheDocument();
    expect(row).not.toHaveAttribute("data-ringing");
    expect(within(row).queryByText(RINGING_REASON)).toBeNull();
    cellsOfRow(alert).forEach((cell) => {
      expect(cell).not.toHaveClass(PULSE);
      expect(cell.style.getPropertyValue("--blink-row-tint")).toBe("");
    });
  };

  it("puts the pulse on an overlay behind every cell of a critical firing plain row", () => {
    const [critical] = renderRinging(true);
    const row = rowOf(critical);
    const cells = cellsOfRow(critical);

    expect(row).toHaveAttribute("data-ringing", "true");
    expect(row).not.toHaveClass("cursor-pointer");
    expect(row.getAttribute("style")).toBeNull();
    expect(cells).toHaveLength(4);
    cells.forEach((cell) => {
      expect(cell).toHaveClass(...OVERLAY);
      expect(cell.style.getPropertyValue("--blink-row-tint")).not.toBe("");
      expect(cell.style.getPropertyValue("--blink-row-edge")).not.toBe("");
    });
    expect(cells[0]).toHaveClass("before:border-l-2");
    expect(cells[cells.length - 1]).toHaveClass("before:border-r-2");
    cells.slice(1, -1).forEach((cell) => {
      expect(cell).not.toHaveClass("before:border-l-2");
      expect(cell).not.toHaveClass("before:border-r-2");
    });
    expect(cells[0].firstElementChild).not.toHaveTextContent(RINGING_REASON);
    expect(cells[0].lastElementChild).toHaveTextContent(RINGING_REASON);
    expect(cells[0].lastElementChild).toHaveClass("sr-only", "select-none");
    expect(screen.getAllByText(RINGING_REASON)).toHaveLength(1);
  });

  it("lets the outline reach both sides of the widget, which has no side padding", () => {
    const [critical] = renderRinging(true);
    const cells = cellsOfRow(critical);

    expect(widgetRoot().className).not.toMatch(/(^|\s)p[xlr]?-/);
    expect(rowOf(critical).firstElementChild).toBe(cells[0]);
    expect(rowOf(critical).lastElementChild).toBe(cells[cells.length - 1]);
  });

  it("leaves resolved, non-critical, numeric and upper-case rows as they were", () => {
    const [, numeric, upperCase, resolved, high] = renderRinging(true);

    [numeric, upperCase, resolved, high].forEach(expectQuiet);
  });

  it("does not ring a deleted critical firing alert", () => {
    const [, , , , , deleted] = renderRinging(true);

    expectQuiet(deleted);
    expect(screen.getAllByText(RINGING_REASON)).toHaveLength(1);
  });

  it.each([false, undefined])(
    "rings nothing when the preset's noisy flag is %s",
    (presetNoisy) => {
      renderRinging(presetNoisy);

      expect(document.querySelector("[data-ringing]")).toBeNull();
      expect(
        document.querySelector(".motion-safe\\:before\\:animate-ringing-pulse")
      ).toBeNull();
      expect(screen.queryByText(RINGING_REASON)).toBeNull();
    }
  );

  it("rings the child rows of a grouped widget while its group headers stay quiet", () => {
    const [critical, numeric, , , high] = renderRinging(true, {
      alertTable: { groupBy: "service" },
    });

    expect(groupHeaders().length).toBeGreaterThan(1);
    groupHeaders().forEach((header) =>
      expect(header).not.toHaveAttribute("data-ringing")
    );
    expect(rowOf(critical)).toHaveAttribute("data-ringing", "true");
    cellsOfRow(critical).forEach((cell) => expect(cell).toHaveClass(...OVERLAY));
    expectQuiet(numeric);
    expectQuiet(high);
  });

  it("rings a collapsed group's header while one of its alerts would, and only that group's", () => {
    renderRinging(true, { alertTable: { groupBy: "service" } });

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));

    expect(bodyRows()).toHaveLength(0);
    const checkout = groupHeader("checkout");
    const headerCell = checkout.querySelector("td") as HTMLElement;
    expect(checkout).toHaveAttribute("data-ringing", "true");
    expect(headerCell).toHaveClass(
      ...OVERLAY,
      "before:border-l-2",
      "before:border-r-2"
    );
    expect(within(checkout).getByText(RINGING_REASON)).toHaveClass("sr-only");
    groupHeaders()
      .filter((header) => header !== checkout)
      .forEach((header) => {
        expect(header).not.toHaveAttribute("data-ringing");
        expect(within(header).queryByText(RINGING_REASON)).toBeNull();
      });
  });

  it("keeps the opaque tint on a ringing row's pinned cells, under the overlay", () => {
    const [critical] = renderRinging(true);

    expect(widgetRoot()).toHaveClass(
      "[&_td.sticky]:[background:var(--widget-opaque-bg)]"
    );
    expect(widgetRoot().className).not.toContain("[data-ringing]");
    const pinned = cellsOfRow(critical).slice(0, 3);
    pinned.forEach((cell) => {
      expect(cell).toHaveClass("sticky", ...OVERLAY);
      expect(cell).not.toHaveClass("!bg-inherit");
    });
  });

  describe("pulse sync", () => {
    const synced: Element[] = [];

    beforeEach(() => {
      synced.length = 0;
      Object.defineProperty(HTMLElement.prototype, "getAnimations", {
        configurable: true,
        value: function (this: HTMLElement) {
          const element = this;
          return [
            {
              effect: { target: element, pseudoElement: "::before" },
              set startTime(value: number) {
                if (value === 0) {
                  synced.push(element);
                }
              },
            },
          ];
        },
      });
    });

    it.each([false, true])(
      "starts every ringing cell's pulse at the page's time zero (edit mode: %s)",
      (isEditMode) => {
        const [critical, numeric, , , high, deleted] = renderRinging(
          true,
          {},
          { isEditMode }
        );

        expect(
          widgetRoot().querySelector("tbody")!.hasAttribute("inert")
        ).toBe(isEditMode);
        expect(synced).toEqual(expect.arrayContaining(cellsOfRow(critical)));
        [numeric, high, deleted].forEach((alert) =>
          cellsOfRow(alert).forEach((cell) =>
            expect(synced).not.toContain(cell)
          )
        );
      }
    );
  });
});
