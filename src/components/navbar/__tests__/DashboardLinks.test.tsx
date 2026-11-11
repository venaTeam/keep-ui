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
  }: {
    dashboard: { id: string; dashboard_name: string };
    deleteDashboard: (id: string) => void;
  }) => (
    <button onClick={() => deleteDashboard(dashboard.id)}>
      delete {dashboard.dashboard_name}
    </button>
  ),
}));

const deleteFrom = async (path: string, name: string) => {
  window.history.replaceState(null, "", path);
  render(<DashboardLinks />);
  fireEvent.click(screen.getByText(`delete ${name}`));
  await waitFor(() => expect(mockDelete).toHaveBeenCalled());
  await Promise.resolve();
};

beforeEach(() => {
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
