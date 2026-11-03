import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "../[id]/dashboard";
import { useDashboardEditMode } from "../DashboardEditModeContext";

const mockPost = jest.fn();
const mockMutate = jest.fn();
let mockDashboards: any[] | undefined;
let mockId = "Ops";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: mockId }),
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/shared/lib/hooks/useApi", () => ({
  useApi: () => ({ post: mockPost, isReady: () => true }),
}));

jest.mock("utils/hooks/useDashboards", () => ({
  useDashboards: () => ({
    dashboards: mockDashboards,
    isLoading: !mockDashboards,
    mutate: mockMutate,
  }),
}));

jest.mock("utils/hooks/useDashboardPresets", () => ({
  useDashboardPreset: () => [],
}));

jest.mock("@/utils/hooks/useDashboardMetricWidgets", () => ({
  useDashboardMetricWidgets: () => ({ widgets: [] }),
}));

jest.mock("@/components/filters/GenericFilters", () => ({
  GenericFilters: () => <div data-testid="date-filter" />,
}));

jest.mock("@/utils/metrics", () => ({
  recordAction: jest.fn(),
  recordPageLoad: jest.fn(),
  recordError: jest.fn(),
}));

jest.mock("react-toastify", () => ({ toast: { success: jest.fn() } }));

jest.mock("@/shared/ui", () => ({ showErrorToast: jest.fn() }));

// The grid is replaced by a stub that shows the edit-mode flag the panels see
// and lets a test move a panel.
jest.mock("../GridLayout", () => ({
  __esModule: true,
  default: ({ layout, onLayoutChange }: any) => {
    const isEditMode = useDashboardEditMode();
    return (
      <div data-testid="grid" data-edit-mode={String(isEditMode)}>
        {layout.map((l: any) => (
          <span key={l.i} data-testid={`pos-${l.i}`}>
            {l.x}
          </span>
        ))}
        <button
          onClick={() =>
            onLayoutChange(layout.map((l: any) => ({ ...l, x: l.x + 5 })))
          }
        >
          move-panels
        </button>
      </div>
    );
  },
}));

jest.mock("../WidgetModal", () => ({
  __esModule: true,
  default: () => <div data-testid="widget-modal" />,
}));

jest.mock("../dashboard-appearance/DashboardSettingsPanel", () => ({
  DashboardSettingsPanel: () => <div data-testid="settings-panel" />,
}));

const savedDashboard = (name = "Ops") => ({
  id: "d1",
  dashboard_name: name,
  dashboard_config: {
    layout: [{ i: "w1", x: 0, y: 0, w: 3, h: 3 }],
    widget_data: [{ i: "w1", x: 0, y: 0, w: 3, h: 3, name: "Panel" }],
  },
});

// jsdom has no structuredClone; dashboard config is plain JSON.
if (typeof globalThis.structuredClone !== "function") {
  globalThis.structuredClone = (value: any) => JSON.parse(JSON.stringify(value));
}

const byCy = (cy: string) => document.querySelector(`[data-cy="${cy}"]`);
const click = (cy: string) => fireEvent.click(byCy(cy)!);

beforeEach(() => {
  mockId = "Ops";
  mockDashboards = [savedDashboard()];
  mockPost.mockReset();
  mockMutate.mockReset();
});

describe("dashboard view mode", () => {
  it("shows only the date filter and the edit pencil", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("date-filter")).toBeInTheDocument();
    expect(byCy("dashboard-enter-edit-btn")).toBeInTheDocument();
    expect(byCy("dashboard-save-layout-btn")).toBeNull();
    expect(byCy("dashboard-add-widget-btn")).toBeNull();
    expect(byCy("dashboard-customize-btn")).toBeNull();
    expect(byCy("dashboard-cancel-edit-btn")).toBeNull();
    expect(screen.getByTestId("grid")).toHaveAttribute("data-edit-mode", "false");
  });

  it("does not open the add-widget modal from the empty state", () => {
    mockDashboards = [
      { ...savedDashboard(), dashboard_config: { layout: [], widget_data: [] } },
    ];
    render(<DashboardPage />);

    click("dashboard-empty-state");
    expect(screen.queryByTestId("widget-modal")).toBeNull();
  });

  it("does not let the name be renamed", () => {
    render(<DashboardPage />);

    click("dashboard-name");
    expect(byCy("dashboard-name-input")).toBeNull();
  });
});

describe("dashboard edit mode", () => {
  it("shows the edit controls after clicking the pencil", () => {
    render(<DashboardPage />);
    click("dashboard-enter-edit-btn");

    expect(byCy("dashboard-enter-edit-btn")).toBeNull();
    expect(byCy("dashboard-save-layout-btn")).toBeInTheDocument();
    expect(byCy("dashboard-add-widget-btn")).toBeInTheDocument();
    expect(byCy("dashboard-customize-btn")).toBeInTheDocument();
    expect(byCy("dashboard-cancel-edit-btn")).toBeInTheDocument();
    expect(screen.getByTestId("grid")).toHaveAttribute("data-edit-mode", "true");
  });

  it("renames by clicking the name", () => {
    render(<DashboardPage />);
    click("dashboard-enter-edit-btn");
    click("dashboard-name");

    expect(byCy("dashboard-name-input")).toBeInTheDocument();
  });

  it("cancel throws away the changes and returns to view mode", () => {
    render(<DashboardPage />);
    click("dashboard-enter-edit-btn");
    fireEvent.click(screen.getByText("move-panels"));
    expect(screen.getByTestId("pos-w1")).toHaveTextContent("5");

    click("dashboard-cancel-edit-btn");

    expect(screen.getByTestId("pos-w1")).toHaveTextContent("0");
    expect(byCy("dashboard-enter-edit-btn")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("save persists the changes and returns to view mode", async () => {
    mockPost.mockResolvedValue({});
    render(<DashboardPage />);
    click("dashboard-enter-edit-btn");
    fireEvent.click(screen.getByText("move-panels"));

    await act(async () => click("dashboard-save-layout-btn"));

    expect(mockPost).toHaveBeenCalledWith(
      "/dashboard/d1",
      expect.objectContaining({
        dashboard_config: expect.objectContaining({
          layout: [expect.objectContaining({ i: "w1", x: 5 })],
        }),
      }),
      { method: "PUT" }
    );
    await waitFor(() =>
      expect(byCy("dashboard-enter-edit-btn")).toBeInTheDocument()
    );
    expect(screen.getByTestId("pos-w1")).toHaveTextContent("5");
  });

  it("stays in edit mode with the changes when save fails", async () => {
    mockPost.mockRejectedValue(new Error("boom"));
    render(<DashboardPage />);
    click("dashboard-enter-edit-btn");
    fireEvent.click(screen.getByText("move-panels"));

    await act(async () => click("dashboard-save-layout-btn"));

    expect(byCy("dashboard-save-layout-btn")).toBeInTheDocument();
    expect(screen.getByTestId("pos-w1")).toHaveTextContent("5");
  });

  it("a refetch does not overwrite unsaved changes", () => {
    const { rerender } = render(<DashboardPage />);
    click("dashboard-enter-edit-btn");
    fireEvent.click(screen.getByText("move-panels"));

    mockDashboards = [savedDashboard()];
    rerender(<DashboardPage />);

    expect(screen.getByTestId("pos-w1")).toHaveTextContent("5");
  });
});

describe("dashboard switching and new dashboards", () => {
  it("opens a new, unsaved dashboard in edit mode", () => {
    mockId = "My Dashboard";
    render(<DashboardPage />);

    expect(byCy("dashboard-name")).toHaveTextContent("My Dashboard");
    expect(byCy("dashboard-save-layout-btn")).toBeInTheDocument();
    expect(byCy("dashboard-empty-state")).toBeInTheDocument();
  });

  it("leaves edit mode and loads the other dashboard when the id changes", () => {
    mockDashboards = [savedDashboard("Ops"), { ...savedDashboard("Noc"), id: "d2" }];
    const { rerender } = render(<DashboardPage />);
    click("dashboard-enter-edit-btn");
    fireEvent.click(screen.getByText("move-panels"));

    mockId = "Noc";
    rerender(<DashboardPage />);

    expect(byCy("dashboard-name")).toHaveTextContent("Noc");
    expect(byCy("dashboard-enter-edit-btn")).toBeInTheDocument();
    expect(screen.getByTestId("pos-w1")).toHaveTextContent("0");
  });
});
