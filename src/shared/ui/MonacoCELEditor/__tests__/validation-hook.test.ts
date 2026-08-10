import { act, renderHook, waitFor } from "@testing-library/react";
import { useApi } from "@/shared/lib/hooks/useApi";
import { useCelValidation } from "../validation-hook";

// Matches the debounce inside useCelValidation.
const DEBOUNCE_MS = 500;

describe("useCelValidation", () => {
  const mockPost = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    (useApi as jest.Mock).mockReturnValue({
      post: mockPost,
      isReady: () => true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("validates the debounced expression rather than the latest keystroke", async () => {
    mockPost.mockResolvedValue([]);

    const { rerender } = renderHook(({ cel }) => useCelValidation(cel), {
      initialProps: { cel: "" },
    });

    rerender({ cel: "a" });
    act(() => jest.advanceTimersByTime(DEBOUNCE_MS));

    // The SWR key is built from the debounced value, so the body must match it.
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith("/cel/validate", { cel: "a" });
  });

  it("returns markers once the backend reports errors", async () => {
    mockPost.mockResolvedValue([{ columnStart: 1, columnEnd: 5 }]);

    const { result, rerender } = renderHook(
      ({ cel }) => useCelValidation(cel),
      { initialProps: { cel: "" } }
    );

    expect(result.current).toEqual([]);

    rerender({ cel: "severity ==" });
    act(() => jest.advanceTimersByTime(DEBOUNCE_MS));

    await waitFor(() => expect(result.current).toHaveLength(1));
  });
});
