import { renderHook } from "@testing-library/react";
import { useRefreshAlertQueries } from "../use-refresh-alert-queries";

const mockRevalidate = jest.fn();

jest.mock("@/shared/lib/state-utils", () => ({
  useRevalidateMultiple: () => mockRevalidate,
}));

describe("useRefreshAlertQueries", () => {
  beforeEach(() => mockRevalidate.mockClear());

  it("revalidates every alert query and the presets", () => {
    const { result } = renderHook(() => useRefreshAlertQueries());
    result.current();
    expect(mockRevalidate).toHaveBeenCalledWith(["/alerts/query", "/preset"]);
  });
});
