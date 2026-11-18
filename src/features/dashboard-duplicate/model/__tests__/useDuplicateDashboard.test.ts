import { renderHook } from "@testing-library/react";
import { KeepApiError } from "@/shared/api";
import { recordAction, recordError } from "@/utils/metrics";
import { useDuplicateDashboard } from "../useDuplicateDashboard";

const mockPost = jest.fn();
const mockMutate = jest.fn();

jest.mock("@/shared/lib/hooks/useApi", () => ({
  useApi: () => ({ post: mockPost }),
}));

jest.mock("@/utils/hooks/useDashboards", () => ({
  useDashboards: () => ({ dashboards: [], mutate: mockMutate }),
}));

jest.mock("@/utils/metrics", () => ({
  recordAction: jest.fn(),
  recordError: jest.fn(),
}));

const existing = { id: "1", dashboard_name: "Ops", dashboard_config: {} };
const created = { id: "2", dashboard_name: "Ops (copy)", dashboard_config: {} };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useDuplicateDashboard", () => {
  it("posts the trimmed name, appends the copy to the cache and records the action", async () => {
    mockPost.mockResolvedValue(created);
    const { result } = renderHook(() => useDuplicateDashboard());

    await expect(
      result.current.duplicateDashboard("a/b 1", "  Ops (copy) ")
    ).resolves.toEqual(created);

    expect(mockPost).toHaveBeenCalledWith("/dashboard/a%2Fb%201/duplicate", {
      dashboard_name: "Ops (copy)",
    });
    expect(mockMutate).toHaveBeenCalledWith(expect.any(Function), {
      revalidate: true,
    });
    const update = mockMutate.mock.calls[0][0];
    expect(update([existing])).toEqual([existing, created]);
    expect(update(undefined)).toEqual([created]);
    expect(recordAction).toHaveBeenCalledWith(
      "duplicate_dashboard",
      expect.any(Number)
    );
    expect(recordError).not.toHaveBeenCalled();
  });

  it("records the status code and rethrows when the request fails", async () => {
    const conflict = new KeepApiError(
      "A dashboard with this name already exists",
      "/dashboard/1/duplicate",
      "",
      {},
      409
    );
    mockPost.mockRejectedValue(conflict);
    const { result } = renderHook(() => useDuplicateDashboard());

    await expect(
      result.current.duplicateDashboard("1", "Ops (copy)")
    ).rejects.toBe(conflict);

    expect(recordError).toHaveBeenCalledWith("duplicate_dashboard", 409);
    expect(mockMutate).not.toHaveBeenCalled();
    expect(recordAction).not.toHaveBeenCalled();
  });

  it("revalidates the dashboards list on refresh", async () => {
    const { result } = renderHook(() => useDuplicateDashboard());

    await result.current.refreshDashboards();

    expect(mockMutate).toHaveBeenCalledWith();
  });
});
