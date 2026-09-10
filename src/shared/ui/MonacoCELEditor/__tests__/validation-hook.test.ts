import { act, renderHook, waitFor } from "@testing-library/react";
import { useApi } from "@/shared/lib/hooks/useApi";
import { KeepApiError } from "@/shared/api";
import { useCelValidation } from "../validation-hook";
import {
  diagnosticsToMarkers,
  getCelDiagnosticsFromError,
  isInvalidCelError,
} from "../cel-validation";

/** Matches the debounce inside useCelValidation. */
const DEBOUNCE_MS = 500;

const VALID = { valid: true, diagnostics: [] };
const INVALID = {
  valid: false,
  diagnostics: [
    {
      code: "EXPECTED_BOOLEAN",
      message: "A CEL filter must evaluate to true or false.",
      range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 8 },
    },
  ],
};

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

  it("validates the debounced expression for the requested context", async () => {
    mockPost.mockResolvedValue(VALID);

    const { rerender } = renderHook(({ cel }) => useCelValidation(cel, "alerts"), {
      initialProps: { cel: "" },
    });

    rerender({ cel: "a" });
    act(() => jest.advanceTimersByTime(DEBOUNCE_MS));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith("/cel/validate", {
      cel: "a",
      context: "alerts",
    });
  });

  it("sends the context it was given", async () => {
    mockPost.mockResolvedValue(VALID);

    const { rerender } = renderHook(
      ({ cel }) => useCelValidation(cel, "maintenance"),
      { initialProps: { cel: "" } }
    );

    rerender({ cel: "a" });
    act(() => jest.advanceTimersByTime(DEBOUNCE_MS));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith("/cel/validate", {
      cel: "a",
      context: "maintenance",
    });
  });

  it("reports the server verdict rather than inferring it from empty markers", async () => {
    mockPost.mockResolvedValue(INVALID);

    const { result, rerender } = renderHook(
      ({ cel }) => useCelValidation(cel, "alerts"),
      { initialProps: { cel: "" } }
    );

    rerender({ cel: '"just a string"' });
    act(() => jest.advanceTimersByTime(DEBOUNCE_MS));

    await waitFor(() => expect(result.current.status).toBe("invalid"));
    expect(result.current.diagnostics).toHaveLength(1);
    expect(result.current.markers).toHaveLength(1);
  });

  it("treats a 200 with valid:true as valid", async () => {
    mockPost.mockResolvedValue(VALID);

    const { result, rerender } = renderHook(
      ({ cel }) => useCelValidation(cel, "alerts"),
      { initialProps: { cel: "" } }
    );

    rerender({ cel: "severity == 'critical'" });
    act(() => jest.advanceTimersByTime(DEBOUNCE_MS));

    await waitFor(() => expect(result.current.status).toBe("valid"));
    expect(result.current.markers).toEqual([]);
  });

  it("never reports a pending check as valid", async () => {
    mockPost.mockImplementation(() => new Promise(() => {}));

    const { result, rerender } = renderHook(
      ({ cel }) => useCelValidation(cel, "alerts"),
      { initialProps: { cel: "" } }
    );

    rerender({ cel: "severity ==" });
    act(() => jest.advanceTimersByTime(DEBOUNCE_MS));

    await waitFor(() => expect(result.current.status).toBe("validating"));
    expect(result.current.status).not.toBe("valid");
    expect(result.current.markers).toEqual([]);
  });

  it("reports a failed request as unknown validity, not as invalid CEL", async () => {
    mockPost.mockRejectedValue(new Error("network down"));

    const { result, rerender } = renderHook(
      ({ cel }) => useCelValidation(cel, "alerts"),
      { initialProps: { cel: "" } }
    );

    // A draft no other test uses: SWR's cache is shared across this file, and a
    // cached verdict would be served instead of the failing request.
    rerender({ cel: "service == 'unreachable-backend'" });
    act(() => jest.advanceTimersByTime(DEBOUNCE_MS));

    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.status).not.toBe("valid");
    expect(result.current.status).not.toBe("invalid");
    expect(result.current.diagnostics).toEqual([]);
  });

  it("labels its state with the draft it describes", async () => {
    mockPost.mockResolvedValue(INVALID);

    const { result, rerender } = renderHook(
      ({ cel }) => useCelValidation(cel, "alerts"),
      { initialProps: { cel: "" } }
    );

    rerender({ cel: "old draft" });
    act(() => jest.advanceTimersByTime(DEBOUNCE_MS));
    await waitFor(() => expect(result.current.status).toBe("invalid"));
    expect(result.current.cel).toBe("old draft");

    // A newer draft has no verdict yet, and must not inherit the old one.
    rerender({ cel: "new draft" });
    expect(result.current.cel).toBe("old draft");
  });

  it("treats an empty expression as a valid (unfiltered) search", () => {
    const { result } = renderHook(() => useCelValidation("", "alerts"));

    expect(result.current.status).toBe("valid");
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("validateNow checks the exact draft without waiting for the debounce", async () => {
    mockPost.mockResolvedValue(INVALID);

    const { result } = renderHook(() => useCelValidation("typed so far", "alerts"));

    let verdict;
    await act(async () => {
      verdict = await result.current.validateNow("the exact draft");
    });

    expect(mockPost).toHaveBeenCalledWith("/cel/validate", {
      cel: "the exact draft",
      context: "alerts",
    });
    expect(verdict).toEqual(INVALID);
  });
});

describe("getCelDiagnosticsFromError", () => {
  const apiError = (status: number, responseJson: any) =>
    new KeepApiError("boom", "/alerts/query", "retry", responseJson, status);

  it("recognises a structured INVALID_CEL rejection", () => {
    const error = apiError(400, {
      detail: {
        code: "INVALID_CEL",
        message: "The CEL filter is invalid.",
        diagnostics: INVALID.diagnostics,
      },
    });

    expect(isInvalidCelError(error)).toBe(true);
    expect(getCelDiagnosticsFromError(error)).toEqual(INVALID.diagnostics);
  });

  it("does not treat every 400 as a CEL problem", () => {
    const error = apiError(400, { detail: "limit must be an integer" });

    expect(isInvalidCelError(error)).toBe(false);
    expect(getCelDiagnosticsFromError(error)).toBeNull();
  });

  it("does not blame CEL for a server failure", () => {
    const error = apiError(500, { message: "An internal server error occurred." });

    expect(isInvalidCelError(error)).toBe(false);
  });

  it("handles a rejection that carries no diagnostics", () => {
    const error = apiError(400, { detail: { code: "INVALID_CEL", message: "x" } });

    expect(isInvalidCelError(error)).toBe(true);
    expect(getCelDiagnosticsFromError(error)).toEqual([]);
  });
});

describe("diagnosticsToMarkers", () => {
  it("uses the documented one-based, end-exclusive coordinates", () => {
    expect(diagnosticsToMarkers(INVALID.diagnostics as any)).toEqual([
      {
        severity: 8,
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 8,
        message: "A CEL filter must evaluate to true or false.",
        source: "CEL",
      },
    ]);
  });

  it("skips a diagnostic with no range instead of underlining a guess", () => {
    expect(
      diagnosticsToMarkers([
        { code: "EXPECTED_BOOLEAN", message: "no position", range: null },
      ] as any)
    ).toEqual([]);
  });
});
