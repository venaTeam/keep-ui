import React from "react";
import { render } from "@testing-library/react";
import { createColumnHelper } from "@tanstack/react-table";
import { AlertTableServerSide } from "@/widgets/alerts-table/ui/alert-table-server-side";
import { AlertDto, Severity, Status } from "@/entities/alerts/model/types";

let mockBodyProps: Record<string, unknown> | undefined;
let mockColumnRenameMapping: Record<string, string> = {};

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
  useConfig: () => ({ data: {} }),
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
];

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

const renderTable = () =>
  render(
    <AlertTableServerSide
      alerts={[alert]}
      alertsTotalCount={1}
      columns={columns}
      presetName="team-feed"
      facetsCel={null}
      facetsPanelRefreshToken={undefined}
    />
  );

const getColumnLabel = () => {
  expect(mockBodyProps).toBeDefined();
  return mockBodyProps?.getColumnLabel as
    | ((columnId: string) => string)
    | undefined;
};

beforeEach(() => {
  mockBodyProps = undefined;
  mockColumnRenameMapping = {};
  localStorage.clear();
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
