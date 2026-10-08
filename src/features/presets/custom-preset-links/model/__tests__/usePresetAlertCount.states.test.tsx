import { renderHook } from "@testing-library/react";
import useSWR from "swr";
import { usePresetAlertCount } from "../usePresetAlertCount";

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }));

jest.mock("@/shared/lib/hooks/useApi", () => ({
  useApi: () => ({ isReady: () => true, post: jest.fn() }),
}));

const mockUseSWR = useSWR as unknown as jest.Mock;

type HookParams = Parameters<typeof usePresetAlertCount>[0];

const renderCount = (params: Partial<HookParams> = {}) =>
  renderHook(() =>
    usePresetAlertCount({
      presetCel: "severity == 'critical'",
      counterShowsFiringOnly: false,
      ...params,
    })
  );

const swrState = (state: {
  data?: number;
  error?: Error;
  isLoading: boolean;
}) => mockUseSWR.mockReturnValue({ mutate: jest.fn(), ...state });

beforeEach(() => {
  mockUseSWR.mockReset();
});

describe("usePresetAlertCount states", () => {
  it("lets a grouped error win over a retry that is loading again", () => {
    swrState({ data: undefined, error: new Error("x"), isLoading: true });
    const { result } = renderCount({ groupBy: "incident" });

    expect(result.current).toEqual({
      totalCount: 0,
      isLoading: false,
      isError: true,
    });
  });

  it("keeps a grouped request without an error loading", () => {
    swrState({ data: 4, error: undefined, isLoading: true });
    const { result } = renderCount({ groupBy: "incident" });

    expect(result.current).toEqual({
      totalCount: 4,
      isLoading: true,
      isError: false,
    });
  });

  it("returns the stale number next to a grouped error", () => {
    swrState({ data: 5, error: new Error("x"), isLoading: false });
    const { result } = renderCount({ groupBy: "incident" });

    expect(result.current).toEqual({
      totalCount: 5,
      isLoading: false,
      isError: true,
    });
  });

  it("leaves an ungrouped failure with the raw loading value", () => {
    swrState({ data: undefined, error: new Error("x"), isLoading: true });
    const { result } = renderCount();

    expect(result.current).toEqual({
      totalCount: 0,
      isLoading: true,
      isError: false,
    });
  });
});
