import { DRAFT_STATES, DraftView } from "@/entities/assistant";
import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";
import { CardState, getDraftCardState } from "../draft-card-state";

type GoldenDraft = keyof typeof golden.drafts;

const draft = (name: GoldenDraft) =>
  golden.drafts[name] as unknown as DraftView;

const BEFORE_EXPIRY = Date.parse("2026-11-24T10:29:59+00:00");
const AT_EXPIRY = Date.parse("2026-11-24T10:30:00+00:00");
const options = { readOnly: false, now: BEFORE_EXPIRY, isSubmitting: false };

const STATES: Record<GoldenDraft, CardState> = {
  pending: "draft",
  pending_not_permitted: "not-permitted",
  applying: "submitting",
  applying_outcome_pending: "submitting",
  applied: "saved",
  applied_nothing_to_change: "saved",
  applied_unverified: "saved",
  partially_applied: "partial",
  failed: "error",
  failed_rejected: "error",
  failed_rejected_maybe_written: "error",
  failed_not_permitted: "not-permitted",
  failed_read_only: "read-only",
  failed_unauthenticated: "error",
  failed_interrupted: "error",
  failed_outcome_unknown: "error",
  discarded: "declined",
  expired: "expired",
  pending_resolve: "draft",
  pending_reopen: "draft",
};

it("shows a draft that has not arrived as streaming", () => {
  expect(getDraftCardState(null, options)).toBe("streaming");
});

it.each(Object.keys(STATES) as GoldenDraft[])("shows the draft %s", (name) => {
  expect(getDraftCardState(draft(name), options)).toBe(STATES[name]);
});

it("has a row for every draft and every state of the contract", () => {
  expect(Object.keys(STATES).sort()).toEqual(Object.keys(golden.drafts).sort());
  const states = Object.values(golden.drafts).map(({ state }) => state);
  expect(new Set(states)).toEqual(new Set(DRAFT_STATES));
});

describe("a pending draft", () => {
  it.each<[string, Partial<typeof options>, CardState]>([
    ["in read-only mode", { readOnly: true }, "read-only"],
    ["being confirmed", { isSubmitting: true }, "submitting"],
    ["just before its expiry", { now: BEFORE_EXPIRY }, "draft"],
    ["at its expiry", { now: AT_EXPIRY }, "expired"],
    [
      "confirmed just before its expiry",
      { now: AT_EXPIRY, isSubmitting: true },
      "submitting",
    ],
    [
      "expired in read-only mode",
      { now: AT_EXPIRY, readOnly: true },
      "read-only",
    ],
  ])("%s", (_, overrides, state) => {
    expect(
      getDraftCardState(draft("pending"), { ...options, ...overrides })
    ).toBe(state);
  });

  it("that may not be confirmed stays so after its expiry", () => {
    expect(
      getDraftCardState(draft("pending_not_permitted"), {
        ...options,
        now: AT_EXPIRY,
      })
    ).toBe("not-permitted");
  });

  it.each([["not a date"], [""], [null]])(
    "with the expiry %j is left to the server",
    (expiresAt) => {
      expect(
        getDraftCardState(
          { ...draft("pending"), expires_at: expiresAt as string },
          { ...options, now: AT_EXPIRY }
        )
      ).toBe("draft");
    }
  );
});

// The 200 of a Confirm may carry `applying`, and any later read the rest
it.each(
  DRAFT_STATES.filter((state) => state !== "pending" && state !== "applying")
)("shows %s whatever the page is doing", (state) => {
  const final: DraftView = { ...draft("applied"), state };
  const expected = getDraftCardState(final, options);
  expect(expected).not.toBe("submitting");
  expect(
    getDraftCardState(final, {
      readOnly: true,
      now: AT_EXPIRY,
      isSubmitting: true,
    })
  ).toBe(expected);
});

it.each(Object.keys(golden.outcomes) as (keyof typeof golden.outcomes)[])(
  "shows a failed draft with the object-kind outcome %s as an error",
  (name) => {
    const outcome = golden.outcomes[name] as DraftView["outcome"];
    const failed: DraftView = { ...draft("failed"), outcome };
    expect(getDraftCardState(failed, options)).toBe("error");
  }
);

it("shows an outcome code of a newer gateway by the draft's state", () => {
  const applied = golden.future.drafts.applied as unknown as DraftView;
  expect(getDraftCardState(applied, options)).toBe("saved");
  const failed: DraftView = { ...applied, state: "failed" };
  expect(getDraftCardState(failed, options)).toBe("error");
});

it("shows a failed draft without an outcome as an error", () => {
  expect(
    getDraftCardState({ ...draft("failed"), outcome: null }, options)
  ).toBe("error");
});
