import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useApi } from "@/shared/lib/hooks/useApi";
import { INVALID_CEL_MESSAGE } from "@/shared/ui/MonacoCELEditor/cel-validation";

/** jest.setup.ts stubs the builder for other suites; this one tests it. */
jest.unmock("@/features/presets/presets-manager/ui/alerts-rules-builder");

/**
 * Stand in for the Monaco editor with a plain textarea, but keep the *real*
 * validation hook behind it. The builder's own state machine is what is under
 * test here, driven by real server responses (mocked at the API boundary).
 */
jest.mock("@/features/cel-input/cel-input", () => {
  const React = require("react");
  const {
    useCelValidation,
  } = require("@/shared/ui/MonacoCELEditor/validation-hook");

  return {
    __esModule: true,
    default: ({
      value,
      onValueChange,
      onKeyDown,
      onValidationChange,
      validationContext,
      validateWhileTyping,
    }: any) => {
      const validation = useCelValidation(value, validationContext, {
        validateWhileTyping,
      });

      React.useEffect(() => {
        onValidationChange?.(validation);
      }, [validation]);

      return React.createElement("textarea", {
        "data-testid": "cel-input",
        value,
        onChange: (e: any) => onValueChange(e.target.value),
        onKeyDown: (e: any) =>
          onKeyDown?.({ key: e.key, preventDefault: () => {} }),
      });
    },
  };
});

jest.mock("@/entities/presets/model/usePresetActions", () => ({
  usePresetActions: () => ({ deletePreset: jest.fn() }),
}));

jest.mock("@/features/filter", () => ({
  useFacetPotentialFields: () => ({ data: [] }),
}));

const { AlertsRulesBuilder } = jest.requireActual(
  "@/features/presets/presets-manager/ui/alerts-rules-builder"
);

const DEBOUNCE_MS = 500;
const VALID = { valid: true, diagnostics: [] };
/** Backend diagnostic wording, which must never reach the screen. */
const BACKEND_WORDING = "A CEL filter must evaluate to true or false.";
const INVALID = {
  valid: false,
  diagnostics: [{ code: "EXPECTED_BOOLEAN", message: BACKEND_WORDING }],
};

/** Unique per test so a shared SWR cache entry cannot answer for another. */
let draftCounter = 0;
const uniqueDraft = (prefix: string) => `${prefix}_${++draftCounter}`;

describe("AlertsRulesBuilder", () => {
  const mockPost = jest.fn();
  const onCelChanges = jest.fn();

  const renderBuilder = (props: any = {}) =>
    render(
      <AlertsRulesBuilder
        defaultQuery=""
        onCelChanges={onCelChanges}
        showSqlImport={false}
        {...props}
      />
    );

  const type = (text: string) =>
    fireEvent.change(screen.getByTestId("cel-input"), {
      target: { value: text },
    });

  const pressEnter = () =>
    fireEvent.keyDown(screen.getByTestId("cel-input"), { key: "Enter" });

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

  it("shows the existing message and applies nothing when the preflight rejects the draft", async () => {
    mockPost.mockResolvedValue(INVALID);
    const draft = uniqueDraft("'just a string'");

    renderBuilder();
    onCelChanges.mockClear();

    type(draft);
    await act(async () => {
      pressEnter();
    });

    expect(await screen.findByTestId("cel-error")).toHaveTextContent(
      INVALID_CEL_MESSAGE
    );
    // The rejected draft was never applied, so no query is made for it.
    expect(onCelChanges).not.toHaveBeenCalledWith(draft);
  });

  it("shows only the existing message, never the backend's own wording", async () => {
    mockPost.mockResolvedValue(INVALID);

    renderBuilder();
    type(uniqueDraft("'just a string'"));
    await act(async () => {
      pressEnter();
    });

    const error = await screen.findByTestId("cel-error");
    expect(error).toHaveTextContent(INVALID_CEL_MESSAGE);
    // The diagnostic's own message is used for positioning only.
    expect(error).not.toHaveTextContent(BACKEND_WORDING);
    expect(screen.queryByText(BACKEND_WORDING)).not.toBeInTheDocument();
  });

  it("applies the draft once the server has accepted it", async () => {
    mockPost.mockResolvedValue(VALID);
    const draft = uniqueDraft("severity == 'critical'");

    renderBuilder();
    onCelChanges.mockClear();

    type(draft);
    await act(async () => {
      pressEnter();
    });

    await waitFor(() => expect(onCelChanges).toHaveBeenCalledWith(draft));
    expect(screen.queryByTestId("cel-error")).not.toBeInTheDocument();
  });

  it("validates on Enter without waiting for the typing debounce", async () => {
    mockPost.mockResolvedValue(VALID);
    const draft = uniqueDraft("severity == 'high'");

    renderBuilder();
    type(draft);

    // No debounce has elapsed, so background validation has not fired yet.
    expect(mockPost).not.toHaveBeenCalled();

    await act(async () => {
      pressEnter();
    });

    expect(mockPost).toHaveBeenCalledWith("/cel/validate", {
      cel: draft,
      context: "alerts",
    });
  });

  it("does not apply an older draft when the user edits while a check is pending", async () => {
    const first = uniqueDraft("first");
    const second = uniqueDraft("second");
    let resolveFirst: (value: any) => void = () => {};
    mockPost.mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = resolve))
    );

    renderBuilder();
    onCelChanges.mockClear();

    type(first);
    act(() => {
      pressEnter();
    });

    // The user keeps typing before the verdict lands.
    type(second);

    await act(async () => {
      resolveFirst(VALID);
    });

    expect(onCelChanges).not.toHaveBeenCalledWith(first);
    expect(screen.queryByTestId("cel-error")).not.toBeInTheDocument();
  });

  it("lets a corrected expression be applied straight after a rejection", async () => {
    const bad = uniqueDraft("'bad'");
    const good = uniqueDraft("severity == 'critical'");
    mockPost.mockResolvedValueOnce(INVALID).mockResolvedValueOnce(VALID);

    renderBuilder();
    onCelChanges.mockClear();

    type(bad);
    await act(async () => {
      pressEnter();
    });
    expect(await screen.findByTestId("cel-error")).toBeInTheDocument();

    type(good);
    // Editing clears the obsolete diagnostics without touching the applied filter.
    expect(screen.queryByTestId("cel-error")).not.toBeInTheDocument();

    await act(async () => {
      pressEnter();
    });

    await waitFor(() => expect(onCelChanges).toHaveBeenCalledWith(good));
  });

  it("reports a validation-service failure as unavailable, not as invalid CEL", async () => {
    mockPost.mockRejectedValue(new Error("network down"));

    renderBuilder();
    type(uniqueDraft("severity == 'critical'"));
    await act(async () => {
      pressEnter();
    });

    expect(
      await screen.findByTestId("cel-validation-unavailable")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("cel-error")).not.toBeInTheDocument();
  });

  it("shows the existing message when the query rejected the applied expression", async () => {
    mockPost.mockResolvedValue(VALID);
    const draft = uniqueDraft("severity == 'critical'");

    const { rerender } = render(
      <AlertsRulesBuilder
        defaultQuery=""
        celValue={draft}
        onCelChanges={onCelChanges}
        showSqlImport={false}
        isCelRejected={false}
      />
    );

    rerender(
      <AlertsRulesBuilder
        defaultQuery=""
        celValue={draft}
        onCelChanges={onCelChanges}
        showSqlImport={false}
        isCelRejected={true}
      />
    );

    const error = await screen.findByTestId("cel-error");
    expect(error).toHaveTextContent(INVALID_CEL_MESSAGE);
  });

  describe("Save", () => {
    const saveButton = () => screen.getByTestId("save-preset-button");

    it("stays disabled while the draft is unchecked", () => {
      mockPost.mockImplementation(() => new Promise(() => {}));

      renderBuilder({ showSave: true });
      type(uniqueDraft("severity == 'critical'"));

      expect(saveButton()).toBeDisabled();
    });

    it("stays disabled while a check is pending", async () => {
      mockPost.mockImplementation(() => new Promise(() => {}));

      renderBuilder({ showSave: true });
      type(uniqueDraft("severity == 'critical'"));
      act(() => {
        pressEnter();
      });

      await waitFor(() => expect(mockPost).toHaveBeenCalled());
      expect(saveButton()).toBeDisabled();
    });

    it("stays disabled when the server rejected the draft", async () => {
      mockPost.mockResolvedValue(INVALID);

      renderBuilder({ showSave: true });
      type(uniqueDraft("'just a string'"));
      await act(async () => {
        pressEnter();
      });

      expect(mockPost).toHaveBeenCalled();
      expect(saveButton()).toBeDisabled();
    });

    it("stays disabled when the check could not be completed", async () => {
      mockPost.mockRejectedValue(new Error("network down"));

      renderBuilder({ showSave: true });
      type(uniqueDraft("severity == 'critical'"));
      await act(async () => {
        pressEnter();
      });

      expect(mockPost).toHaveBeenCalled();
      expect(saveButton()).toBeDisabled();
    });

    it("enables once the server accepted this exact draft", async () => {
      mockPost.mockResolvedValue(VALID);

      renderBuilder({ showSave: true });
      type(uniqueDraft("severity == 'critical'"));
      await act(async () => {
        pressEnter();
      });

      await waitFor(() => expect(saveButton()).not.toBeDisabled());
    });

    it("goes back to disabled as soon as the user edits an accepted draft", async () => {
      mockPost.mockResolvedValue(VALID);

      renderBuilder({ showSave: true });
      type(uniqueDraft("severity == 'critical'"));
      await act(async () => {
        pressEnter();
      });
      await waitFor(() => expect(saveButton()).not.toBeDisabled());

      // The verdict describes the previous text, so it cannot vouch for this one.
      type(uniqueDraft("severity == 'critical' && "));
      expect(saveButton()).toBeDisabled();
    });
  });

  describe("applyOnTyping", () => {
    it("only emits a draft the server accepted", async () => {
      mockPost.mockResolvedValue(VALID);
      const draft = uniqueDraft("severity == 'critical'");

      renderBuilder({ applyOnTyping: true, shouldSetQueryParam: false });
      onCelChanges.mockClear();

      type(draft);
      // Not yet checked - must not be emitted as an applied value.
      expect(onCelChanges).not.toHaveBeenCalledWith(draft);

      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_MS);
      });

      await waitFor(() => expect(onCelChanges).toHaveBeenCalledWith(draft));
    });

    it("clears the applied value when the server rejects the draft", async () => {
      mockPost.mockResolvedValue(INVALID);

      renderBuilder({ applyOnTyping: true, shouldSetQueryParam: false });
      onCelChanges.mockClear();

      const draft = uniqueDraft("'just a string'");
      type(draft);
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_MS);
      });

      expect(await screen.findByTestId("cel-error")).toBeInTheDocument();
      expect(onCelChanges).not.toHaveBeenCalledWith(draft);
    });
  });
});

/**
 * The alerts search asks the server once per commit - never per keystroke, and
 * never twice for the same expression.
 */
describe("AlertsRulesBuilder request economy", () => {
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

  const renderBuilder = () =>
    render(<AlertsRulesBuilder defaultQuery="" showSqlImport={false} />);

  const type = (text: string) =>
    fireEvent.change(screen.getByTestId("cel-input"), {
      target: { value: text },
    });

  const pressEnter = () =>
    fireEvent.keyDown(screen.getByTestId("cel-input"), { key: "Enter" });

  it("asks nothing while the user types", async () => {
    mockPost.mockResolvedValue(VALID);

    renderBuilder();
    for (const cel of ["s", "se", "sev", "seve"]) {
      type(cel);
      await act(async () => {
        jest.advanceTimersByTime(DEBOUNCE_MS * 2);
      });
    }

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("asks exactly once per Enter", async () => {
    mockPost.mockResolvedValue(VALID);

    renderBuilder();
    type(uniqueDraft("severity == 'critical'"));
    await act(async () => {
      pressEnter();
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("does not re-ask when Enter is pressed again on an accepted draft", async () => {
    mockPost.mockResolvedValue(VALID);

    renderBuilder();
    type(uniqueDraft("severity == 'critical'"));
    await act(async () => {
      pressEnter();
    });
    await act(async () => {
      pressEnter();
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("does not re-ask when Enter is pressed again on a rejected draft", async () => {
    mockPost.mockResolvedValue(INVALID);

    renderBuilder();
    type(uniqueDraft("'just a string'"));
    await act(async () => {
      pressEnter();
    });
    await act(async () => {
      pressEnter();
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId("cel-error")).toBeInTheDocument();
  });

  it("does not re-ask for a draft the user returns to", async () => {
    mockPost.mockResolvedValue(VALID);
    const first = uniqueDraft("first");
    const second = uniqueDraft("second");

    renderBuilder();

    type(first);
    await act(async () => {
      pressEnter();
    });
    type(second);
    await act(async () => {
      pressEnter();
    });
    expect(mockPost).toHaveBeenCalledTimes(2);

    type(first);
    await act(async () => {
      pressEnter();
    });

    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it("does not ask at all when the filter is cleared", async () => {
    mockPost.mockResolvedValue(VALID);

    renderBuilder();
    type("");
    await act(async () => {
      pressEnter();
    });

    expect(mockPost).not.toHaveBeenCalled();
  });
});
