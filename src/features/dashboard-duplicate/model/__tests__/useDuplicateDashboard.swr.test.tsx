import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useDashboards } from "@/utils/hooks/useDashboards";
import { useDuplicateDashboard } from "../useDuplicateDashboard";

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock("@/shared/lib/hooks/useApi", () => ({
  useApi: () => ({ isReady: () => true, get: mockGet, post: mockPost }),
}));

jest.mock("@/utils/metrics", () => ({
  recordAction: jest.fn(),
  recordError: jest.fn(),
}));

const existing = { id: "1", dashboard_name: "Ops", dashboard_config: {} };
const created = { id: "2", dashboard_name: "Ops (copy)", dashboard_config: {} };

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useDuplicateDashboard with real SWR", () => {
  it("resolves after the cache write without waiting for the list refetch", async () => {
    let finishRefetch: (value: unknown) => void = () => {};
    let refetchSettled = false;
    mockGet.mockResolvedValueOnce([existing]).mockReturnValueOnce(
      new Promise((resolve) => {
        finishRefetch = resolve;
      }).finally(() => {
        refetchSettled = true;
      })
    );
    mockPost.mockResolvedValue(created);
    const { result } = renderHook(
      () => ({ list: useDashboards(), duplicate: useDuplicateDashboard() }),
      { wrapper }
    );
    await waitFor(() =>
      expect(result.current.list.dashboards).toEqual([existing])
    );

    let outcome: unknown = "pending";
    await act(async () => {
      result.current.duplicate
        .duplicateDashboard("1", "Ops (copy)")
        .then((value) => {
          outcome = value;
        });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(outcome).toEqual(created);
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(refetchSettled).toBe(false);
    expect(result.current.list.dashboards).toEqual([existing, created]);

    await act(async () => {
      finishRefetch([existing, created]);
    });
  });
});
