import React from "react";
import { act, render } from "@testing-library/react";
import { ColumnDef, createColumnHelper, Table } from "@tanstack/react-table";
import { useAssistantContextStore } from "@/entities/assistant";
import { AlertTableServerSide } from "@/widgets/alerts-table/ui/alert-table-server-side";
import { AlertDto, Severity, Status } from "@/entities/alerts/model/types";

let mockBodyProps: Record<string, unknown> | undefined;
let mockColumnRenameMapping: Record<string, string> = {};
let mockConfig: Record<string, unknown> = {};

const mockNull = () => null;

jest.mock("@/entities/alerts/model", () =>
  jest.requireActual("@/entities/alerts/model")
);
jest.mock("@/widgets/alerts-table/ui/alerts-table-body", () => ({
  AlertsTableBody: (props: Record<string, unknown>) => {
    mockBodyProps = props;
    return null;
  },
}));
jest.mock("@/widgets/alerts-table/ui/alert-table-headers", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/widgets/alerts-table/ui/column-resize-indicator", () => ({
  ColumnResizeIndicator: () => null,
}));
jest.mock("@/widgets/alerts-table/ui/alert-actions", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/widgets/alerts-table/ui/SettingsSelection", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/features/presets/presets-manager", () => ({
  AlertPresetManager: () => null,
  evalWithContext: jest.fn(),
}));
jest.mock("@/features/alerts/alert-detail-sidebar", () => ({
  AlertSidebar: () => null,
}));
jest.mock("@/features/filter/facet-panel-server-side", () => ({
  FacetsPanelServerSide: () => null,
}));
jest.mock("@/features/filter", () => ({
  Pagination: () => null,
}));
jest.mock("@/features/alerts/simulate-alert", () => ({
  PushAlertToServerModal: () => null,
}));
jest.mock("@/components/ui/DateRangePickerV2", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/shared/ui/MonacoCELEditor", () => ({
  INVALID_CEL_MESSAGE: "invalid",
}));
jest.mock("@/features/keyboard-shortcuts", () => ({
  useIsShiftKeyHeld: () => false,
}));
jest.mock("@/shared/lib/hooks/useHydratedSession", () => ({
  useHydratedSession: () => ({ data: null }),
}));
jest.mock("@/utils/hooks/useConfig", () => ({
  useConfig: () => ({ data: mockConfig }),
}));
jest.mock("@/components/ui/useTimeframeState", () => ({
  useTimeframeState: () => [null, jest.fn()],
}));
jest.mock("@/entities/presets/model", () => ({
  ...jest.requireActual("@/entities/presets/model"),
  usePresetColumnState: () => ({
    columnVisibility: {},
    columnOrder: ["name", "service"],
    columnRenameMapping: mockColumnRenameMapping,
    columnTimeFormats: {},
    columnListFormats: {},
    setColumnTimeFormats: jest.fn(),
    setColumnListFormats: jest.fn(),
    setColumnOrder: jest.fn(),
    setColumnVisibility: jest.fn(),
    setColumnRenameMapping: jest.fn(),
    updateMultipleColumnConfigs: jest.fn(),
    useBackend: false,
    isLoading: false,
  }),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/alerts/feed",
  useSearchParams: () => new URLSearchParams(),
}));

const columnHelper = createColumnHelper<AlertDto>();
const columns = [
  columnHelper.accessor("name", { id: "name" }),
  columnHelper.accessor("service", { id: "service" }),
] as ColumnDef<AlertDto>[];

const alert = {
  id: "a1",
  event_id: "e1",
  fingerprint: "fp-1",
  name: "disk-full",
  status: Status.Firing,
  severity: Severity.Warning,
  lastReceived: new Date("2026-10-01T10:00:00Z"),
  environment: "prod",
  source: ["prometheus"],
  pushed: true,
  deleted: false,
  ticket_url: "",
  enriched_fields: [],
} as AlertDto;

const tableOf = (alerts: AlertDto[]) => (
  <AlertTableServerSide
    alerts={alerts}
    alertsTotalCount={alerts.length}
    columns={columns}
    presetName="team-feed"
    facetsCel={null}
    facetsPanelRefreshToken={undefined}
  />
);

const renderTable = (alerts = [alert]) => render(tableOf(alerts));

const getColumnLabel = () => {
  expect(mockBodyProps).toBeDefined();
  return mockBodyProps?.getColumnLabel as
    | ((columnId: string) => string)
    | undefined;
};

beforeEach(() => {
  mockBodyProps = undefined;
  mockColumnRenameMapping = {};
  mockConfig = {};
  localStorage.clear();
  useAssistantContextStore.setState(
    useAssistantContextStore.getInitialState(),
    true
  );
});

describe("AlertTableServerSide group labels", () => {
  it("labels a renamed column by its rename, so its empty group reads 'No <rename>'", () => {
    mockColumnRenameMapping = { service: "Team" };

    renderTable();

    expect(getColumnLabel()?.("service")).toBe("Team");
  });

  it("falls back to the start-cased column id", () => {
    mockColumnRenameMapping = { service: "" };

    renderTable();

    expect(getColumnLabel()?.("service")).toBe("Service");
    expect(getColumnLabel()?.("lastReceived")).toBe("Last Received");
  });
});

describe("AlertTableServerSide assistant selection", () => {
  const make = (number: number, service: string): AlertDto => ({
    ...alert,
    id: `a${number}`,
    fingerprint: `fp-${number}`,
    name: `alert ${number}`,
    service,
  });
  const alerts = [make(1, "api"), make(2, "api"), make(3, "db")];
  const selected = (number: number) => ({
    fingerprint: `fp-${number}`,
    name: `alert ${number}`,
    severity: Severity.Warning,
    status: Status.Firing,
  });

  const table = () => mockBodyProps?.table as Table<AlertDto>;
  const getSelection = () => useAssistantContextStore.getState().selection;
  const select = (...keys: string[]) =>
    act(() =>
      table().setRowSelection(
        Object.fromEntries(keys.map((key) => [key, true]))
      )
    );
  const groupBy = (...columnIds: string[]) =>
    act(() => table().setGrouping(columnIds));

  beforeEach(() => {
    mockConfig = { KEEP_ASSISTANT_ENABLED: true };
  });

  it("is what is ticked, and nothing else", () => {
    renderTable(alerts);
    expect(getSelection()).toEqual([]);
    select("fp-1", "fp-3");
    expect(getSelection()).toEqual([selected(1), selected(3)]);
    act(() => table().setRowSelection({ "fp-1": false, "fp-3": true }));
    expect(getSelection()).toEqual([selected(3)]);
    act(() => table().resetRowSelection());
    expect(getSelection()).toEqual([]);
  });

  it("has an alert of another page by its fingerprint only", () => {
    const { rerender } = renderTable(alerts);
    select("fp-1", "fp-2");
    rerender(tableOf([make(2, "api"), make(4, "db")]));
    expect(getSelection()).toEqual([{ fingerprint: "fp-1" }, selected(2)]);

    rerender(tableOf(alerts));
    expect(getSelection()).toEqual([selected(1), selected(2)]);
  });

  it("has the state of the alerts as it is now", () => {
    const { rerender } = renderTable(alerts);
    select("fp-1");
    rerender(tableOf([{ ...alerts[0], status: Status.Resolved }]));
    expect(getSelection()).toEqual([
      { ...selected(1), status: Status.Resolved },
    ]);
  });

  describe("with grouping", () => {
    const groupRow = (id: string) => table().getGroupedRowModel().rowsById[id];

    it("has the alerts of a ticked group, and not its header", () => {
      renderTable(alerts);
      groupBy("service");
      act(() => groupRow("service:api").toggleSelected(true));
      // This is what the table itself has
      expect(Object.keys(table().getState().rowSelection)).toContain(
        "service:api"
      );
      expect(getSelection()).toEqual([selected(1), selected(2)]);
    });

    it("has none of the headers of nested groups", () => {
      renderTable(alerts);
      groupBy("service", "name");
      act(() => groupRow("service:api").toggleSelected(true));
      expect(
        Object.keys(table().getState().rowSelection).filter((key) =>
          key.includes(":")
        ).length
      ).toBeGreaterThan(1);
      expect(getSelection()).toEqual([selected(1), selected(2)]);
    });

    it("does not take a header for an alert after the group is gone", () => {
      const { rerender } = renderTable(alerts);
      groupBy("service");
      act(() => groupRow("service:api").toggleSelected(true));

      rerender(tableOf([make(4, "db")]));
      expect(getSelection()).toEqual([
        { fingerprint: "fp-1" },
        { fingerprint: "fp-2" },
      ]);
      groupBy();
      expect(getSelection()).toEqual([
        { fingerprint: "fp-1" },
        { fingerprint: "fp-2" },
      ]);
      rerender(tableOf(alerts));
      expect(getSelection()).toEqual([selected(1), selected(2)]);
    });
  });

  it("does not change with a render that changes nothing", () => {
    const onChange = jest.fn();
    const { rerender } = renderTable(alerts);
    select("fp-1");
    const unsubscribe = useAssistantContextStore.subscribe(onChange);
    rerender(tableOf(alerts));
    // As a poll: new objects, the same alerts
    rerender(tableOf(alerts.map((item) => ({ ...item }))));
    unsubscribe();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is gone with the table", () => {
    const { unmount } = renderTable(alerts);
    select("fp-1");
    unmount();
    expect(getSelection()).toEqual([]);
  });

  it.each([
    ["without the flag", {}],
    [
      "with AI features disabled",
      { KEEP_ASSISTANT_ENABLED: true, KEEP_AI_FEATURES_DISABLED: true },
    ],
  ])("is not looked at %s", (_, config) => {
    mockConfig = config;
    const onChange = jest.fn();
    const unsubscribe = useAssistantContextStore.subscribe(onChange);
    const { unmount } = renderTable(alerts);
    select("fp-1");
    unmount();
    unsubscribe();
    expect(onChange).not.toHaveBeenCalled();
    expect(getSelection()).toEqual([]);
  });
});
