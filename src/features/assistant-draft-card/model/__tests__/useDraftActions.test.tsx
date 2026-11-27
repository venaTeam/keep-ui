import { act, renderHook } from "@testing-library/react";
import { DraftView } from "@/entities/assistant";
import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";
import { KeepApiError } from "@/shared/api";
import { useApi } from "@/shared/lib/hooks/useApi";
import { recordAction, recordError } from "@/utils/metrics";
import { DERIVED_REFUSED, useDraftActions } from "../useDraftActions";

jest.mock("@/utils/metrics", () => ({
  recordAction: jest.fn(),
  recordError: jest.fn(),
}));

const post = jest.fn();
const onChange = jest.fn();
const onUncertain = jest.fn();

const pending = golden.drafts.pending as unknown as DraftView;
const applied = golden.drafts.applied as unknown as DraftView;
const applying = golden.drafts.applying as unknown as DraftView;

const refusal = (name: keyof typeof golden.errors) => {
  const { status, body } = golden.errors[name];
  return new KeepApiError(body.detail, "/x", "", body, status);
};

const setup = () =>
  renderHook(() => useDraftActions(pending.id, { onChange, onUncertain }));

beforeEach(() => {
  jest.resetAllMocks();
  onUncertain.mockResolvedValue(undefined);
  (useApi as jest.Mock).mockReturnValue({ post });
});

describe("confirm", () => {
  it.each([
    ["final", applied],
    // Same status, and the poll goes on from here
    ["still applying", applying],
  ])("hands over a draft that is %s", async (_, draft) => {
    post.mockResolvedValue(draft);
    const { result } = setup();
    await act(() => result.current.confirm());
    expect(post).toHaveBeenCalledWith(
      `/assistant/drafts/${pending.id}/confirm`
    );
    expect(onChange).toHaveBeenCalledWith(draft);
    expect(result.current.error).toBeNull();
    expect(recordAction).toHaveBeenCalledWith(
      "assistant_confirm",
      expect.any(Number)
    );
  });

  it("is sent once for a double click", async () => {
    let resolve: (draft: DraftView) => void = () => {};
    post.mockReturnValue(new Promise((done) => (resolve = done)));
    const { result } = setup();
    act(() => {
      result.current.confirm();
      result.current.confirm();
      result.current.discard();
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(result.current.isConfirming).toBe(true);
    await act(async () => resolve(applied));
    expect(result.current.isConfirming).toBe(false);
  });

  it.each(["draft_not_pending", "draft_expired", "draft_applying"] as const)(
    "takes the current draft from a 409 %s",
    async (name) => {
      const error = refusal(name);
      post.mockRejectedValue(error);
      const { result } = setup();
      await act(() => result.current.confirm());
      expect(onChange).toHaveBeenCalledWith(
        (error.responseJson as { draft: DraftView }).draft
      );
      expect(onUncertain).not.toHaveBeenCalled();
      expect(result.current.error).toBeNull();
      expect(recordError).toHaveBeenCalledWith("assistant_confirm", 409);
    }
  );

  it("may be tried again after a 502 from before the write", async () => {
    post.mockRejectedValueOnce(refusal("gateway_unavailable"));
    const { result } = setup();
    await act(() => result.current.confirm());
    expect(result.current.error).toBe("Couldn't reach Keep, try again.");
    expect(onChange).not.toHaveBeenCalled();
    expect(onUncertain).not.toHaveBeenCalled();

    post.mockResolvedValueOnce(applied);
    await act(() => result.current.confirm());
    expect(result.current.error).toBeNull();
    expect(onChange).toHaveBeenCalledWith(applied);
  });

  it.each([
    ["a network error", new TypeError("Failed to fetch"), undefined],
    ["a plain-text 500", new Error("An error occurred"), undefined],
    ["a JSON 500", refusal("internal"), 500],
    ["an answer of another shape", "ok", undefined],
  ])("reads the conversation again after %s", async (_, outcome, status) => {
    if (outcome instanceof Error) {
      post.mockRejectedValue(outcome);
    } else {
      post.mockResolvedValue(outcome);
    }
    const { result } = setup();
    let finishRefetch: () => void = () => {};
    onUncertain.mockReturnValue(
      new Promise<void>((done) => (finishRefetch = done))
    );
    let confirming: Promise<void> = Promise.resolve();
    await act(async () => {
      confirming = result.current.confirm();
    });
    // Nothing else may be pressed until it is known what happened
    expect(result.current.isConfirming).toBe(true);
    await act(async () => {
      finishRefetch();
      await confirming;
    });
    expect(onUncertain).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Couldn't reach Keep, try again.");
    expect(recordError).toHaveBeenCalledWith("assistant_confirm", status);
    expect(recordAction).not.toHaveBeenCalled();
  });

  it("reads the conversation again when the draft is gone", async () => {
    post.mockRejectedValue(refusal("draft_not_found"));
    const { result } = setup();
    await act(() => result.current.confirm());
    expect(onUncertain).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(
      golden.errors.draft_not_found.body.detail
    );
  });

  it("says why it was refused", async () => {
    post.mockRejectedValue(refusal("forbidden"));
    const { result } = setup();
    await act(() => result.current.confirm());
    expect(result.current.error).toBe(golden.errors.forbidden.body.detail);
    expect(onUncertain).not.toHaveBeenCalled();
    expect(result.current.refusedReason).toBeNull();
  });

  it("sends the body the kind derived", async () => {
    const body = {
      derived: {
        cel_roundtrip: "severity == 'critical'",
        sql_query: { sql: "severity = :p0", params: { p0: "critical" } },
      },
    };
    post.mockResolvedValue(applied);
    const { result } = setup();
    await act(() => result.current.confirm(body));
    expect(post).toHaveBeenCalledWith(
      `/assistant/drafts/${pending.id}/confirm`,
      body
    );
  });

  it.each(["confirm_derived_required", "confirm_derived_invalid"] as const)(
    "is refused for good by a 400 %s",
    async (name) => {
      post.mockRejectedValue(refusal(name));
      const { result } = setup();
      await act(() => result.current.confirm());
      expect(result.current.refusedReason).toBe(DERIVED_REFUSED);
      expect(result.current.error).toBeNull();
      expect(onUncertain).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    }
  );

  it("is refused for good by a 409 draft_unsupported, in the server's words", async () => {
    post.mockRejectedValue(refusal("draft_unsupported"));
    const { result } = setup();
    await act(() => result.current.confirm());
    expect(result.current.refusedReason).toBe(
      golden.errors.draft_unsupported.body.detail
    );
    expect(result.current.error).toBeNull();
    expect(onUncertain).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(recordError).toHaveBeenCalledWith("assistant_confirm", 409);
  });

  it("is not refused for good by a 400 about another field", async () => {
    post.mockRejectedValue(refusal("validation"));
    const { result } = setup();
    await act(() => result.current.confirm());
    expect(result.current.refusedReason).toBeNull();
    expect(result.current.error).toBe(golden.errors.validation.body.detail);
  });
});

describe("discard", () => {
  it("hands over the discarded draft, and is no Confirm", async () => {
    const discarded = golden.drafts.discarded as unknown as DraftView;
    post.mockResolvedValue(discarded);
    const { result } = setup();
    await act(() => result.current.discard());
    expect(post).toHaveBeenCalledWith(
      `/assistant/drafts/${pending.id}/discard`
    );
    expect(onChange).toHaveBeenCalledWith(discarded);
    expect(recordAction).not.toHaveBeenCalled();
  });

  it("takes the current draft from a 409", async () => {
    const error = refusal("draft_applying");
    post.mockRejectedValue(error);
    const { result } = setup();
    await act(() => result.current.discard());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(recordError).not.toHaveBeenCalled();
  });

  it("sends the reason it was given", async () => {
    post.mockResolvedValue(golden.drafts.discarded);
    const { result } = setup();
    await act(() => result.current.discard({ reason: "opened_in_form" }));
    expect(post).toHaveBeenCalledWith(
      `/assistant/drafts/${pending.id}/discard`,
      { reason: "opened_in_form" }
    );
  });

  it("is never refused for good, unlike Confirm", async () => {
    post.mockRejectedValue(refusal("draft_unsupported"));
    const { result } = setup();
    await act(() => result.current.discard());
    expect(result.current.refusedReason).toBeNull();
    expect(result.current.error).toBe(
      golden.errors.draft_unsupported.body.detail
    );
  });
});

it("does nothing without a draft", async () => {
  const { result } = renderHook(() =>
    useDraftActions(undefined, { onChange, onUncertain })
  );
  await act(() => result.current.confirm());
  expect(post).not.toHaveBeenCalled();
});
