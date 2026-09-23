import { act, renderHook, waitFor } from "@testing-library/react";
import { useApi } from "@/shared/lib/hooks/useApi";
import { KeepApiError } from "@/shared/api";
import { useCelValidation } from "../validation-hook";
import {
  INVALID_CEL_MESSAGE,
  diagnosticsToMarkers,
  isInvalidCelError,
} from "../cel-validation";

/** Matches the debounce used by editors that validate while typing. */
const DEBOUNCE_MS = 500;

const VALID = { valid: true, diagnostics: [] };
/** Backend diagnostic wording, which must never reach the screen. */
const BACKEND_WORDING = "A CEL filter must evaluate to true or false.";
const INVALID = {
  valid: false,
  diagnostics: [
    {
      code: "EXPECTED_BOOLEAN",
      message: BACKEND_WORDING,
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

  describe("on demand (the default)", () => {
    it("does not validate while the user types", async () => {
      mockPost.mockResolvedValue(VALID);

      const { result, rerender } = renderHook(
        ({ cel }) => useCelValidation(cel, "alerts"),
        { initialProps: { cel: "" } }
      );

      rerender({ cel: "severity == 'critical'" });
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });

      expect(mockPost).not.toHaveBeenCalled();
      expect(result.current.status).toBe("unchecked");
    });

    it("validates the exact draft it is asked about", async () => {
      mockPost.mockResolvedValue(VALID);

      const { result } = renderHook(() => useCelValidation("typed", "alerts"));

      let verdict;
      await act(async () => {
        verdict = await result.current.validateNow("the exact draft");
      });

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith("/cel/validate", {
        cel: "the exact draft",
        context: "alerts",
      });
      expect(verdict).toEqual(VALID);
      expect(result.current.cel).toBe("the exact draft");
      expect(result.current.status).toBe("valid");
    });

    it("sends the context it was given", async () => {
      mockPost.mockResolvedValue(VALID);

      const { result } = renderHook(() =>
        useCelValidation("x", "maintenance")
      );

      await act(async () => {
        await result.current.validateNow("x");
      });

      expect(mockPost).toHaveBeenCalledWith("/cel/validate", {
        cel: "x",
        context: "maintenance",
      });
    });

    it("answers a repeated draft without asking again", async () => {
      mockPost.mockResolvedValue(INVALID);

      const { result } = renderHook(() => useCelValidation("x", "alerts"));

      await act(async () => {
        await result.current.validateNow("same draft");
      });
      expect(mockPost).toHaveBeenCalledTimes(1);

      let verdict;
      await act(async () => {
        verdict = await result.current.validateNow("same draft");
      });

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(verdict).toEqual(INVALID);
      expect(result.current.status).toBe("invalid");
    });

    it("asks again for a different draft", async () => {
      mockPost.mockResolvedValue(VALID);

      const { result } = renderHook(() => useCelValidation("x", "alerts"));

      await act(async () => {
        await result.current.validateNow("draft one");
        await result.current.validateNow("draft two");
      });

      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it("does not ask about an empty expression", async () => {
      const { result } = renderHook(() => useCelValidation("", "alerts"));

      let verdict;
      await act(async () => {
        verdict = await result.current.validateNow("");
      });

      expect(mockPost).not.toHaveBeenCalled();
      expect(verdict).toEqual({ valid: true, diagnostics: [] });
      expect(result.current.status).toBe("valid");
    });
  });

  describe("validateWhileTyping", () => {
    const renderTyping = (cel: string) =>
      renderHook(
        ({ cel }) =>
          useCelValidation(cel, "alerts", { validateWhileTyping: true }),
        { initialProps: { cel } }
      );

    it("validates the draft the user paused on, not every keystroke", async () => {
      mockPost.mockResolvedValue(VALID);

      const { rerender } = renderTyping("");

      for (const cel of ["s", "se", "sev", "seve", "sever"]) {
        rerender({ cel });
        act(() => {
          jest.advanceTimersByTime(50);
        });
      }
      expect(mockPost).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(DEBOUNCE_MS);
      });

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith("/cel/validate", {
        cel: "sever",
        context: "alerts",
      });
    });

    it("reports the server verdict rather than inferring it", async () => {
      mockPost.mockResolvedValue(INVALID);

      const { result, rerender } = renderTyping("");

      rerender({ cel: '"just a string"' });
      await act(async () => {
        jest.advanceTimersByTime(DEBOUNCE_MS);
      });

      await waitFor(() => expect(result.current.status).toBe("invalid"));
      expect(result.current.diagnostics).toHaveLength(1);
      expect(result.current.markers).toHaveLength(1);
    });

    it("never reports a pending check as valid", async () => {
      mockPost.mockImplementation(() => new Promise(() => {}));

      const { result, rerender } = renderTyping("");

      rerender({ cel: "severity ==" });
      await act(async () => {
        jest.advanceTimersByTime(DEBOUNCE_MS);
      });

      await waitFor(() => expect(result.current.status).toBe("validating"));
      expect(result.current.markers).toEqual([]);
    });
  });

  it("reports a failed request as unknown validity, not as invalid CEL", async () => {
    mockPost.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useCelValidation("x", "alerts"));

    await act(async () => {
      await expect(
        result.current.validateNow("severity == 'critical'")
      ).rejects.toThrow("network down");
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.status).not.toBe("valid");
    expect(result.current.status).not.toBe("invalid");
    expect(result.current.diagnostics).toEqual([]);
  });

  it("does not remember a failed check as a verdict", async () => {
    mockPost.mockRejectedValueOnce(new Error("network down"));
    mockPost.mockResolvedValueOnce(VALID);

    const { result } = renderHook(() => useCelValidation("x", "alerts"));

    await act(async () => {
      await result.current.validateNow("retry me").catch(() => {});
    });
    await act(async () => {
      await result.current.validateNow("retry me");
    });

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("valid");
  });

  it("does not let a superseded answer overwrite a newer one", async () => {
    let resolveFirst: (value: any) => void = () => {};
    mockPost.mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = resolve))
    );
    mockPost.mockResolvedValueOnce(VALID);

    const { result } = renderHook(() => useCelValidation("x", "alerts"));

    let firstCall: Promise<any> = Promise.resolve();
    act(() => {
      firstCall = result.current.validateNow("older draft").catch(() => {});
    });

    await act(async () => {
      await result.current.validateNow("newer draft");
    });
    expect(result.current.cel).toBe("newer draft");
    expect(result.current.status).toBe("valid");

    // The older request lands late with a rejection; it must not take over.
    await act(async () => {
      resolveFirst(INVALID);
      await firstCall;
    });

    expect(result.current.cel).toBe("newer draft");
    expect(result.current.status).toBe("valid");
  });

  it("labels its state with the draft it describes", async () => {
    mockPost.mockResolvedValue(INVALID);

    const { result, rerender } = renderHook(
      ({ cel }) => useCelValidation(cel, "alerts"),
      { initialProps: { cel: "old draft" } }
    );

    await act(async () => {
      await result.current.validateNow("old draft");
    });
    expect(result.current.cel).toBe("old draft");

    // A newer draft has no verdict yet, and must not inherit the old one.
    rerender({ cel: "new draft" });
    expect(result.current.cel).toBe("old draft");
  });
});

describe("isInvalidCelError", () => {
  const apiError = (status: number, responseJson: any) =>
    new KeepApiError("boom", "/alerts/query", "retry", responseJson, status);

  it("recognises a structured INVALID_CEL rejection", () => {
    expect(
      isInvalidCelError(
        apiError(400, {
          detail: {
            code: "INVALID_CEL",
            message: "The CEL filter is invalid.",
            diagnostics: INVALID.diagnostics,
          },
        })
      )
    ).toBe(true);
  });

  it("does not treat every 400 as a CEL problem", () => {
    expect(
      isInvalidCelError(apiError(400, { detail: "limit must be an integer" }))
    ).toBe(false);
  });

  it("does not blame CEL for a server failure", () => {
    expect(
      isInvalidCelError(
        apiError(500, { message: "An internal server error occurred." })
      )
    ).toBe(false);
  });

  it("recognises a rejection that carries no diagnostics", () => {
    expect(
      isInvalidCelError(apiError(400, { detail: { code: "INVALID_CEL", message: "x" } }))
    ).toBe(true);
  });

  it("is not fooled by a non-API error", () => {
    expect(isInvalidCelError(new Error("network down"))).toBe(false);
    expect(isInvalidCelError(undefined)).toBe(false);
  });
});

describe("diagnosticsToMarkers", () => {
  it("uses the documented coordinates but only the single user-facing message", () => {
    expect(diagnosticsToMarkers(INVALID.diagnostics as any)).toEqual([
      {
        severity: 8,
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 8,
        // The diagnostic supplies the position; the wording is always ours.
        message: INVALID_CEL_MESSAGE,
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
