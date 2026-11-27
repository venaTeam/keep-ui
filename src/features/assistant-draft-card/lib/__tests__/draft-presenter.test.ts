import { DraftView } from "@/entities/assistant";
import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";
import { CardState } from "../draft-card-state";
import {
  ALERT_RESULT_LABELS,
  canOpenInForm,
  DraftPresenter,
  getConfirmBlockedReason,
  NO_CONFIRM_INPUT,
  presentWith,
  splitRefreshKeys,
} from "../draft-presenter";

const pending = golden.drafts.pending as unknown as DraftView;

interface NotePayload {
  note: string;
}

const presenter = (
  overrides: Partial<DraftPresenter<NotePayload>> = {}
): DraftPresenter<NotePayload> => ({
  kind: "write_note",
  tool: "write_note",
  parse: () => ({ note: "hello" }),
  Body: () => null,
  confirmLabel: ({ note }) => `Save "${note}"`,
  notPermittedText: "You can't write notes",
  refreshKeys: () => [],
  resultLabels: ALERT_RESULT_LABELS,
  ...overrides,
});

describe("presentWith", () => {
  it("gives up on a payload the kind can't read", () => {
    expect(presentWith(presenter({ parse: () => null }), pending)).toBeNull();
  });

  it("passes the payload and the draft to the body", () => {
    const presentation = presentWith(presenter(), pending);
    expect(presentation?.body.props).toEqual({
      payload: { note: "hello" },
      draft: pending,
    });
    expect(presentation?.confirmLabel).toBe('Save "hello"');
  });

  it("needs nothing from a kind that has no body, form or follow-up", () => {
    expect(presentWith(presenter(), pending)).toMatchObject({
      confirmInput: NO_CONFIRM_INPUT,
      openInForm: null,
      followUp: null,
    });
  });

  it("asks the kind with the payload and the draft", () => {
    const refreshKeys = jest.fn(() => [{ key: "/notes", isExact: true }]);
    const followUp = jest.fn(() => ({ text: "And then?", fingerprints: [] }));
    const presentation = presentWith(
      presenter({ refreshKeys, followUp }),
      pending
    );
    expect(refreshKeys).toHaveBeenCalledWith(pending, { note: "hello" });
    expect(followUp).toHaveBeenCalledWith(pending, { note: "hello" });
    expect(presentation?.refreshKeys).toEqual([
      { key: "/notes", isExact: true },
    ]);
  });

  it("keeps the first 20 alerts of a follow-up", () => {
    const fingerprints = Array.from(
      { length: 30 },
      (_, index) => `fp-${index}`
    );
    const presentation = presentWith(
      presenter({ followUp: () => ({ text: "Which?", fingerprints }) }),
      pending
    );
    expect(presentation?.followUp).toEqual({
      text: "Which?",
      fingerprints: fingerprints.slice(0, 20),
    });
  });
});

describe("getConfirmBlockedReason", () => {
  const blocked = presentWith(
    presenter({
      confirmInput: () => ({ isBlocked: true, reason: "The filter changed." }),
    }),
    pending
  )!;
  const free = presentWith(presenter(), pending)!;

  it("gives the kind's own reason first", () => {
    expect(getConfirmBlockedReason(blocked, "Refused.")).toBe(
      "The filter changed."
    );
  });

  it("gives the reason the gateway refused for", () => {
    expect(getConfirmBlockedReason(free, "Refused.")).toBe("Refused.");
  });

  it("gives none when nothing stops Confirm", () => {
    expect(getConfirmBlockedReason(free, null)).toBeNull();
  });
});

describe("canOpenInForm", () => {
  const form = { targetPath: "/alerts/feed", data: {} };

  it.each<[string, boolean, CardState, boolean]>([
    ["a permitted draft", true, "draft", true],
    ["a draft that is not permitted", false, "draft", false],
    ["a not-permitted card", false, "not-permitted", false],
    ["read-only mode", true, "read-only", false],
    ["an expired draft", true, "expired", false],
    ["a draft being applied", true, "submitting", false],
    ["a saved draft", true, "saved", false],
    ["a discarded draft", true, "declined", false],
  ])("for %s: %s", (_, permitted, state, expected) => {
    expect(canOpenInForm({ openInForm: form }, { permitted }, state)).toBe(
      expected
    );
  });

  it("is false for a kind without a form", () => {
    expect(
      canOpenInForm({ openInForm: null }, { permitted: true }, "draft")
    ).toBe(false);
  });
});

describe("splitRefreshKeys", () => {
  it("parts exact keys from prefixes, each once", () => {
    expect(
      splitRefreshKeys([
        { key: "/alerts/query", isExact: false },
        { key: "/dashboard", isExact: true },
        { key: "/alerts/query", isExact: false },
        { key: "/dashboard", isExact: true },
        { key: "/preset", isExact: false },
      ])
    ).toEqual({
      prefixes: ["/alerts/query", "/preset"],
      exact: ["/dashboard"],
    });
  });

  it("keeps a key that is asked for both ways in both", () => {
    expect(
      splitRefreshKeys([
        { key: "/rules", isExact: true },
        { key: "/rules", isExact: false },
      ])
    ).toEqual({ prefixes: ["/rules"], exact: ["/rules"] });
  });
});
