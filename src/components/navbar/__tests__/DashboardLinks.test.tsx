import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DashboardLinks } from "../DashboardLinks";

const mockPush = jest.fn();
const mockDelete = jest.fn();
let mockDashboards: { id: string; dashboard_name: string }[] = [];

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => window.location.pathname,
}));

jest.mock("utils/hooks/useDashboards", () => ({
  useDashboards: () => ({
    dashboards: mockDashboards,
    isLoading: false,
    error: null,
    mutate: jest.fn(),
  }),
}));

jest.mock("@/shared/lib/hooks/useApi", () => ({
  useApi: () => ({ delete: mockDelete }),
}));

jest.mock("../DashboardLink", () => ({
  DashboardLink: ({
    dashboard,
    deleteDashboard,
    duplicateDashboard,
  }: {
    dashboard: { id: string; dashboard_name: string };
    deleteDashboard: (id: string) => void;
    duplicateDashboard: (id: string) => void;
  }) => (
    <>
      <button onClick={() => deleteDashboard(dashboard.id)}>
        delete {dashboard.dashboard_name}
      </button>
      <button onClick={() => duplicateDashboard(dashboard.id)}>
        duplicate {dashboard.dashboard_name}
      </button>
    </>
  ),
}));

type MockModalProps = {
  source: { id: string; dashboard_name: string } | null;
  existingNames: string[];
  onClose: () => void;
};
let mockModalProps: MockModalProps | null = null;

jest.mock("@/features/dashboard-duplicate", () => ({
  DuplicateDashboardModal: (props: MockModalProps) => {
    mockModalProps = props;
    return props.source ? (
      <>
        <div>dialog for {props.source.dashboard_name}</div>
        <button onClick={props.onClose}>close dialog</button>
      </>
    ) : null;
  },
}));

const deleteFrom = async (path: string, name: string) => {
  window.history.replaceState(null, "", path);
  render(<DashboardLinks />);
  fireEvent.click(screen.getByText(`delete ${name}`));
  await waitFor(() => expect(mockDelete).toHaveBeenCalled());
  await Promise.resolve();
};

beforeEach(() => {
  mockModalProps = null;
  mockPush.mockReset();
  mockDelete.mockReset().mockResolvedValue({});
  jest.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => jest.restoreAllMocks());

describe("DashboardLinks delete", () => {
  it("goes to the feed when the last dashboard, open, is deleted", async () => {
    mockDashboards = [{ id: "d1", dashboard_name: "Ops" }];
    await deleteFrom("/dashboard/Ops", "Ops");
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/alerts/feed"));
  });

  it("goes to the first remaining dashboard when the open one is deleted", async () => {
    mockDashboards = [
      { id: "d1", dashboard_name: "Ops" },
      { id: "d2", dashboard_name: "Infra" },
    ];
    await deleteFrom("/dashboard/Ops", "Ops");
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/dashboard/Infra")
    );
  });

  it("stays when another dashboard is deleted", async () => {
    mockDashboards = [
      { id: "d1", dashboard_name: "Ops" },
      { id: "d2", dashboard_name: "Infra" },
    ];
    await deleteFrom("/dashboard/Ops", "Infra");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does nothing when the delete is cancelled", async () => {
    mockDashboards = [{ id: "d1", dashboard_name: "Ops" }];
    (window.confirm as jest.Mock).mockReturnValue(false);
    window.history.replaceState(null, "", "/dashboard/Ops");
    render(<DashboardLinks />);
    fireEvent.click(screen.getByText("delete Ops"));
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("DashboardLinks duplicate", () => {
  it("opens the duplicate dialog for the clicked dashboard", () => {
    mockDashboards = [
      { id: "d1", dashboard_name: "Ops" },
      { id: "d2", dashboard_name: "Infra" },
    ];
    render(<DashboardLinks />);
    expect(screen.queryByText(/dialog for/)).toBeNull();
    fireEvent.click(screen.getByText("duplicate Ops"));
    expect(screen.getByText("dialog for Ops")).toBeInTheDocument();
  });

  it("passes every dashboard name as existing names", () => {
    mockDashboards = [
      { id: "d1", dashboard_name: "Ops" },
      { id: "d2", dashboard_name: "Infra" },
    ];
    render(<DashboardLinks />);
    expect(mockModalProps?.existingNames).toEqual(["Ops", "Infra"]);
  });

  it("keeps the clicked dashboard while the list revalidates", () => {
    mockDashboards = [{ id: "d1", dashboard_name: "Ops" }];
    const { rerender } = render(<DashboardLinks />);
    fireEvent.click(screen.getByText("duplicate Ops"));
    const opened = mockModalProps?.source;
    mockDashboards = [{ id: "d1", dashboard_name: "Ops" }];
    rerender(<DashboardLinks />);
    expect(mockModalProps?.source).toBe(opened);
  });

  it("closes the dialog when it asks to close", () => {
    mockDashboards = [{ id: "d1", dashboard_name: "Ops" }];
    render(<DashboardLinks />);
    fireEvent.click(screen.getByText("duplicate Ops"));
    fireEvent.click(screen.getByText("close dialog"));
    expect(screen.queryByText(/dialog for/)).toBeNull();
  });
});
