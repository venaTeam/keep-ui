import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { usePresetAlertCount } from "../usePresetAlertCount";

const mockPost = jest.fn();

jest.mock("@/shared/lib/hooks/useApi", () => ({
  useApi: () => ({ isReady: () => true, post: mockPost }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      provider: () => new Map(),
      dedupingInterval: 0,
      shouldRetryOnError: false,
    }}
  >
    {children}
  </SWRConfig>
);

const CEL = "severity == 'critical'";
const WRAPPED_CEL = "(severity == 'critical')";
const COUNT_URL = "/alerts/query/count";

type HookParams = Parameters<typeof usePresetAlertCount>[0];

const renderCount = (params: Partial<HookParams> = {}) =>
  renderHook(
    () =>
      usePresetAlertCount({
        presetCel: CEL,
        counterShowsFiringOnly: false,
        ...params,
      }),
    { wrapper }
  );

beforeEach(() => {
  mockPost.mockReset();
});

describe("usePresetAlertCount request", () => {
  it("posts only the cel for an ungrouped count", async () => {
    mockPost.mockResolvedValue(7);
    const { result } = renderCount();

    await waitFor(() => expect(result.current.totalCount).toBe(7));
    expect(mockPost).toHaveBeenCalledWith(COUNT_URL, { cel: WRAPPED_CEL });
    expect(result.current.isError).toBe(false);
  });

  it("asks for distinct incidents with the active status by default", async () => {
    mockPost.mockResolvedValue(3);
    const { result } = renderCount({ groupBy: "incident" });

    await waitFor(() => expect(result.current.totalCount).toBe(3));
    expect(mockPost).toHaveBeenCalledWith(COUNT_URL, {
      cel: WRAPPED_CEL,
      group_by: "incident",
      incident_status: "active",
    });
  });

  it("forwards an explicit incident status", async () => {
    mockPost.mockResolvedValue(2);
    renderCount({ groupBy: "incident", incidentStatus: "acknowledged" });

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith(COUNT_URL, {
      cel: WRAPPED_CEL,
      group_by: "incident",
      incident_status: "acknowledged",
    });
  });

  it("never sends an incident status for another field", async () => {
    mockPost.mockResolvedValue(4);
    renderCount({ groupBy: "service", incidentStatus: "firing" });

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith(COUNT_URL, {
      cel: WRAPPED_CEL,
      group_by: "service",
    });
  });

  it("composes the firing-only filter into the cel", async () => {
    mockPost.mockResolvedValue(1);
    renderCount({ groupBy: "incident", counterShowsFiringOnly: true });

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith(COUNT_URL, {
      cel: `(status == 'firing') && ${WRAPPED_CEL}`,
      group_by: "incident",
      incident_status: "active",
    });
  });

  it("does not request anything when disabled", async () => {
    const { result } = renderCount({ groupBy: "incident", enabled: false });

    expect(result.current.totalCount).toBe(0);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("keeps different groupings of the same filter apart", async () => {
    mockPost.mockImplementation((_url: string, body: { group_by?: string }) =>
      Promise.resolve(body.group_by === "incident" ? 3 : 9)
    );
    const { result } = renderHook(
      () => ({
        incidents: usePresetAlertCount({
          presetCel: CEL,
          counterShowsFiringOnly: false,
          groupBy: "incident",
        }),
        services: usePresetAlertCount({
          presetCel: CEL,
          counterShowsFiringOnly: false,
          groupBy: "service",
        }),
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.incidents.totalCount).toBe(3);
      expect(result.current.services.totalCount).toBe(9);
    });
  });
});

describe("usePresetAlertCount failures", () => {
  it("reports a failed grouped request as an error", async () => {
    mockPost.mockRejectedValue(new Error("boom"));
    const { result } = renderCount({ groupBy: "incident" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.totalCount).toBe(0);
  });

  it("keeps an ungrouped failure reading as zero without an error flag", async () => {
    mockPost.mockRejectedValue(new Error("boom"));
    const { result } = renderCount();

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toEqual({
      totalCount: 0,
      isLoading: false,
      isError: false,
    });
  });
});
