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

  it("reports isValidating until the backend has checked the current expression", async () => {
    mockPost.mockResolvedValue([{ columnStart: 1, columnEnd: 5 }]);

    const { result, rerender } = renderHook(
      ({ cel }) => useCelValidation(cel),
      { initialProps: { cel: "" } }
    );

    // Nothing typed yet - settled and valid.
    expect(result.current.isValidating).toBe(false);
    expect(result.current.markers).toEqual([]);

    rerender({ cel: "severity ==" });

    // Still inside the debounce window: the expression is unchecked, so the
    // caller must not read the empty marker list as "valid".
    expect(result.current.isValidating).toBe(true);
    expect(mockPost).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(DEBOUNCE_MS));

    await waitFor(() => expect(result.current.isValidating).toBe(false));
    expect(result.current.markers).toHaveLength(1);
  });

  it("validates the debounced expression rather than the latest keystroke", async () => {
    mockPost.mockResolvedValue([]);

    const { rerender } = renderHook(({ cel }) => useCelValidation(cel), {
      initialProps: { cel: "" },
    });

    rerender({ cel: "a" });
    act(() => jest.advanceTimersByTime(DEBOUNCE_MS));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith("/cel/validate", { cel: "a" });
  });
});
