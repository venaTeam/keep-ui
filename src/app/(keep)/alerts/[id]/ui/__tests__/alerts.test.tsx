import { render, screen } from "@testing-library/react";
import { KeepApiError } from "@/shared/api";
import { useAlertsTableData } from "@/widgets/alerts-table/ui/useAlertsTableData";
import Alerts from "../alerts";

/**
 * The alerts screen must survive a failing query: no navigation, no error
 * boundary, and the CEL draft left intact for the user to correct.
 */

jest.mock("@/widgets/alerts-table/ui/useAlertsTableData", () => ({
  useAlertsTableData: jest.fn(),
}));

jest.mock("@/utils/hooks/useProviders", () => ({
  useProviders: () => ({ data: { installed_providers: [] } }),
}));

jest.mock("@/utils/metrics", () => ({ recordPageLoad: jest.fn() }));

/** Records what the page decided about the failure, without a real table. */
const tabPanelProps: any = {};
jest.mock("../alert-table-tab-panel-server-side", () => ({
  __esModule: true,
  default: (props: any) => {
    Object.assign(tabPanelProps, props);
    const React = require("react");
    return React.createElement("div", { "data-testid": "alerts-tab-panel" });
  },
}));

jest.mock("@/features/alerts/alert-history", () => ({
  AlertHistoryModal: () => null,
}));
jest.mock("@/features/alerts/alert-assign-ticket", () => ({
  AlertAssignTicketModal: () => null,
}));
jest.mock("@/features/alerts/alert-note", () => ({ AlertNoteModal: () => null }));
jest.mock("@/features/alerts/alert-call-provider-method", () => ({
  AlertMethodModal: () => null,
}));
jest.mock("@/features/workflows/manual-run-workflow", () => ({
  ManualRunWorkflowModal: () => null,
}));
jest.mock("@/features/alerts/dismiss-alert", () => ({
  AlertDismissModal: () => null,
}));
jest.mock("@/features/alerts/alert-change-status", () => ({
  AlertChangeStatusModal: () => null,
}));
jest.mock("@/features/alerts/alert-assign", () => ({
  AlertAssignModal: () => null,
}));
jest.mock("@/features/alerts/view-alert", () => ({ ViewAlertModal: () => null }));

const mockUseAlertsTableData = useAlertsTableData as jest.Mock;

const withError = (error: unknown) =>
  mockUseAlertsTableData.mockReturnValue({
    alerts: [{ fingerprint: "previous-result" }],
    alertsLoading: false,
    mutateAlerts: jest.fn(),
    alertsError: error,
    totalCount: 7,
    facetsCel: "severity == 'critical'",
    facetsPanelRefreshToken: undefined,
  });

const invalidCelError = () =>
  new KeepApiError(
    "The CEL filter is invalid.",
    "/alerts/query",
    "fix it",
    {
      detail: {
        code: "INVALID_CEL",
        message: "The CEL filter is invalid.",
        diagnostics: [
          { code: "EXPECTED_BOOLEAN", message: "Must be true or false." },
        ],
      },
    },
    400
  );

describe("Alerts page error handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(tabPanelProps).forEach((key) => delete tabPanelProps[key]);
  });

  it("keeps the page mounted and reports an invalid CEL filter locally", () => {
    withError(invalidCelError());

    expect(() => render(<Alerts presetName="feed" />)).not.toThrow();

    expect(screen.getByTestId("alerts-tab-panel")).toBeInTheDocument();
    expect(tabPanelProps.isCelRejected).toBe(true);
    expect(tabPanelProps.queryError).toBeUndefined();
  });

  it("does not re-run facets for a filter the backend rejected", () => {
    withError(invalidCelError());

    render(<Alerts presetName="feed" />);

    expect(tabPanelProps.facetsCel).toBeNull();
  });

  it("does not present earlier rows or counts as results of a failed query", () => {
    withError(invalidCelError());

    render(<Alerts presetName="feed" />);

    expect(tabPanelProps.alerts).toEqual([]);
    expect(tabPanelProps.alertsTotalCount).toBe(0);
  });

  it("keeps the page mounted for a real server failure and does not blame the CEL", () => {
    withError(
      new KeepApiError(
        "An internal server error occurred.",
        "/alerts/query",
        "retry",
        { message: "An internal server error occurred." },
        500
      )
    );

    expect(() => render(<Alerts presetName="feed" />)).not.toThrow();

    expect(screen.getByTestId("alerts-tab-panel")).toBeInTheDocument();
    expect(tabPanelProps.isCelRejected).toBe(false);
    expect(tabPanelProps.queryError).toBeDefined();
    expect(typeof tabPanelProps.onRetryQuery).toBe("function");
  });

  it("does not treat a generic 400 as invalid CEL", () => {
    withError(
      new KeepApiError(
        "limit must be an integer",
        "/alerts/query",
        "fix it",
        { detail: "limit must be an integer" },
        400
      )
    );

    render(<Alerts presetName="feed" />);

    expect(tabPanelProps.isCelRejected).toBe(false);
    expect(tabPanelProps.queryError).toBeDefined();
  });

  it("renders normally when the query succeeds", () => {
    mockUseAlertsTableData.mockReturnValue({
      alerts: [{ fingerprint: "a" }],
      alertsLoading: false,
      mutateAlerts: jest.fn(),
      alertsError: undefined,
      totalCount: 1,
      facetsCel: "severity == 'critical'",
      facetsPanelRefreshToken: undefined,
    });

    render(<Alerts presetName="feed" />);

    expect(tabPanelProps.isCelRejected).toBe(false);
    expect(tabPanelProps.queryError).toBeUndefined();
    expect(tabPanelProps.alerts).toHaveLength(1);
    expect(tabPanelProps.facetsCel).toBe("severity == 'critical'");
  });
});
