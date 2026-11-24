import { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { SWRConfig } from "swr";
import { KeepApiError } from "@/shared/api";
import { useApi } from "@/shared/lib/hooks/useApi";
import golden from "../../__fixtures__/assistant_stream.json";
import { ConversationView, DraftView } from "../types";
import { useAssistantConversation } from "../useAssistantConversation";

const get = jest.fn();
const onMissing = jest.fn();

const finished = golden.conversations.finished as unknown as ConversationView;
const pending = golden.drafts.pending as unknown as DraftView;

const withDraft = (
  draft: unknown,
  overrides: Partial<ConversationView> = {}
): ConversationView => ({
  ...finished,
  items: [{ type: "draft", draft: draft as DraftView }],
  ...overrides,
});
const inState = (state: DraftView["state"]): DraftView => ({
  ...pending,
  state,
});

const apiError = (name: keyof typeof golden.errors) => {
  const { status, body } = golden.errors[name];
  return new KeepApiError(body.detail, "/x", "", body, status);
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

type Options = Parameters<typeof useAssistantConversation>[1];

const render = (id: string | null = "c-1", options: Options = {}) =>
  renderHook(
    (props: { id: string | null; options: Options }) =>
      useAssistantConversation(props.id, { onMissing, ...props.options }),
    { wrapper, initialProps: { id, options } }
  );

const advance = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  get.mockReset();
  (useApi as jest.Mock).mockReturnValue({ isReady: () => true, get });
});

afterEach(() => {
  jest.useRealTimers();
});

it("asks nothing without a conversation", async () => {
  const { result } = render(null);
  await advance(10_000);
  expect(get).not.toHaveBeenCalled();
  expect(result.current.view).toBeUndefined();
});

it("reads the conversation once and does not poll a finished one", async () => {
  get.mockResolvedValue(finished);
  const { result } = render();
  await advance(200_000);
  expect(result.current.view).toEqual(finished);
  expect(result.current.isAnswering).toBe(false);
  expect(get).toHaveBeenCalledTimes(1);
});

describe("a conversation that does not exist", () => {
  it("reports a 404 of the first read", async () => {
    get.mockRejectedValue(apiError("conversation_not_found"));
    render();
    await advance(0);
    expect(onMissing).toHaveBeenCalledWith("c-1");
  });

  it("reports a 404 of a later read", async () => {
    get.mockResolvedValueOnce(finished);
    const { result } = render();
    await advance(0);
    get.mockRejectedValue(apiError("conversation_not_found"));
    await act(async () => {
      await result.current.refetch();
    });
    expect(onMissing).toHaveBeenCalledWith("c-1");
  });

  it.each([
    ["a gateway error", apiError("gateway_unavailable")],
    ["an unknown error", new Error("500")],
    [
      "the 404 of a gateway without the assistant",
      new KeepApiError("Not Found", "/x", "", { detail: "Not Found" }, 404),
    ],
  ])("is not assumed after %s", async (_, error) => {
    get.mockRejectedValue(error);
    const { result } = render();
    await advance(0);
    expect(result.current.error).toBe(error);
    expect(onMissing).not.toHaveBeenCalled();
  });
});

describe("a turn on the server", () => {
  const inProgress = { ...finished, turn_in_progress: true };

  it("is polled every 3 s until it is over", async () => {
    get.mockResolvedValue(inProgress);
    const { result } = render();
    await advance(0);
    expect(result.current.isAnswering).toBe(true);

    await advance(2_999);
    expect(get).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(get).toHaveBeenCalledTimes(2);

    get.mockResolvedValue(finished);
    await advance(3_000);
    expect(result.current.isAnswering).toBe(false);
    expect(result.current.view).toEqual(finished);
    const calls = get.mock.calls.length;
    await advance(30_000);
    expect(get).toHaveBeenCalledTimes(calls);
  });

  it("is given up on after 135 s", async () => {
    get.mockResolvedValue(inProgress);
    const { result } = render();
    await advance(132_500);
    expect(result.current.isAnswering).toBe(true);
    await advance(3_000);
    expect(result.current.isAnswering).toBe(false);
    const calls = get.mock.calls.length;
    await advance(60_000);
    expect(get).toHaveBeenCalledTimes(calls);
  });

  it("is not polled while this page streams it", async () => {
    get.mockResolvedValue(inProgress);
    const { result, rerender } = render("c-1", { isStreaming: true });
    await advance(60_000);
    expect(result.current.isAnswering).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);

    rerender({ id: "c-1", options: { isStreaming: false } });
    await advance(3_000);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("counts as over once the stream said so", async () => {
    get.mockResolvedValue(inProgress);
    const { result, rerender } = render("c-1", { isStreaming: true });
    await advance(0);

    let resolve: (view: ConversationView) => void = () => {};
    get.mockReturnValue(new Promise((done) => (resolve = done)));
    act(() => {
      result.current.refetch({ isTurnOver: true });
    });
    rerender({ id: "c-1", options: { isStreaming: false } });
    expect(result.current.isAnswering).toBe(false);

    // The lock may be released a moment after the last event
    await act(async () => resolve(inProgress));
    expect(result.current.isAnswering).toBe(false);
    await advance(10_000);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("stops being polled when the user may not read it any more", async () => {
    get.mockResolvedValueOnce(inProgress);
    const { result } = render();
    await advance(0);
    get.mockRejectedValue(apiError("forbidden"));
    await advance(3_000);
    expect(result.current.isAnswering).toBe(false);
    await advance(30_000);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe("a draft that is applying", () => {
  const applying = withDraft(golden.drafts.applying);

  it("is polled until it is final", async () => {
    get.mockResolvedValue(applying);
    const { result } = render();
    await advance(6_000);
    expect(get).toHaveBeenCalledTimes(3);

    get.mockResolvedValue(withDraft(golden.drafts.applied));
    await advance(3_000);
    expect(result.current.view?.items).toEqual([
      { type: "draft", draft: golden.drafts.applied },
    ]);
    const calls = get.mock.calls.length;
    await advance(30_000);
    expect(get).toHaveBeenCalledTimes(calls);
  });

  it("is polled 3 s after the previous answer, never in parallel", async () => {
    get.mockResolvedValueOnce(applying);
    render();
    await advance(0);

    let resolve: (view: ConversationView) => void = () => {};
    get.mockReturnValue(new Promise((done) => (resolve = done)));
    await advance(20_000);
    expect(get).toHaveBeenCalledTimes(2);

    await act(async () => resolve(applying));
    await advance(2_999);
    expect(get).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["a 502", apiError("gateway_unavailable")],
    ["an unknown error", new Error("An error occurred")],
  ])("keeps being polled after %s", async (_, error) => {
    get.mockResolvedValueOnce(applying);
    const { result } = render();
    await advance(0);
    get.mockRejectedValue(error);
    await advance(9_000);
    expect(get).toHaveBeenCalledTimes(4);
    expect(result.current.view).toEqual(applying);

    get.mockResolvedValue(withDraft(golden.drafts.applied));
    await advance(3_000);
    expect(result.current.view?.items[0]).toEqual({
      type: "draft",
      draft: golden.drafts.applied,
    });
  });

  it("times out after 90 s, and checks again on request", async () => {
    get.mockResolvedValue(applying);
    const id = golden.drafts.applying.id;
    const { result } = render();
    await advance(88_500);
    expect(result.current.timedOutDraftIds.has(id)).toBe(false);
    await advance(3_000);
    expect(result.current.timedOutDraftIds.has(id)).toBe(true);
    const calls = get.mock.calls.length;
    await advance(60_000);
    expect(get).toHaveBeenCalledTimes(calls);

    await act(async () => result.current.checkDraftAgain(id));
    expect(get).toHaveBeenCalledTimes(calls + 1);
    expect(result.current.timedOutDraftIds.has(id)).toBe(false);
    await advance(3_000);
    expect(get).toHaveBeenCalledTimes(calls + 2);
  });

  it("is polled when only the live turn has it", async () => {
    get.mockResolvedValue(finished);
    render("c-1", {
      liveDrafts: [golden.drafts.applying as unknown as DraftView],
    });
    await advance(3_000);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("stops being polled when the conversation is left", async () => {
    get.mockResolvedValue(applying);
    const { rerender, unmount } = render();
    await advance(0);
    rerender({ id: null, options: {} });
    await advance(30_000);
    expect(get).toHaveBeenCalledTimes(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("replaceDraft", () => {
  it("shows the returned draft at once", async () => {
    get.mockResolvedValue(withDraft(pending));
    const { result } = render();
    await advance(0);
    act(() => result.current.replaceDraft(inState("discarded")));
    expect(result.current.view?.items).toEqual([
      { type: "draft", draft: inState("discarded") },
    ]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("is not undone by an answer that was asked for before it", async () => {
    get.mockResolvedValueOnce(withDraft(pending));
    const { result } = render();
    await advance(0);

    let resolveOld: (view: ConversationView) => void = () => {};
    get.mockReturnValueOnce(new Promise((done) => (resolveOld = done)));
    get.mockResolvedValueOnce(withDraft(inState("applied")));
    act(() => {
      result.current.refetch();
    });
    act(() => result.current.replaceDraft(inState("applied")));
    await act(async () => resolveOld(withDraft(inState("pending"))));

    expect(get).toHaveBeenCalledTimes(3);
    expect(result.current.view?.items).toEqual([
      { type: "draft", draft: inState("applied") },
    ]);
  });
});

it("ignores an answer that a later one overtook", async () => {
  get.mockResolvedValueOnce(withDraft(pending));
  const { result } = render();
  await advance(0);

  let resolveOld: (view: ConversationView) => void = () => {};
  get.mockReturnValueOnce(new Promise((done) => (resolveOld = done)));
  get.mockResolvedValueOnce(withDraft(inState("applied")));
  await act(async () => {
    result.current.refetch();
    await result.current.refetch();
  });
  await act(async () => resolveOld(withDraft(pending)));
  expect(result.current.view?.items).toEqual([
    { type: "draft", draft: inState("applied") },
  ]);
});

it("ignores an answer for a conversation that was left", async () => {
  get.mockResolvedValueOnce(withDraft(pending));
  const { result, rerender } = render();
  await advance(0);

  let resolveOld: (view: ConversationView) => void = () => {};
  get.mockReturnValueOnce(new Promise((done) => (resolveOld = done)));
  get.mockResolvedValue({ ...finished, id: "c-2" });
  act(() => {
    result.current.refetch();
  });
  rerender({ id: "c-2", options: {} });
  await advance(0);
  await act(async () => resolveOld(withDraft(inState("applied"))));
  expect(result.current.view?.id).toBe("c-2");
});
