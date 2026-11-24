import { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { SWRConfig } from "swr";
import { KeepApiError } from "@/shared/api";
import { useApi } from "@/shared/lib/hooks/useApi";
import golden from "../../__fixtures__/assistant_stream.json";
import { AssistantChatError } from "../../api/assistant-error";
import {
  StreamBrokenError,
  streamChat,
  StreamChatParams,
} from "../../api/stream-chat";
import { useAssistantPanelStore } from "../assistant-panel-store";
import {
  ChatContext,
  ConversationView,
  DraftView,
  StreamEvent,
} from "../types";
import { DELTA_FLUSH_MS, useAssistantChat } from "../useAssistantChat";

jest.mock("../../api/stream-chat", () => ({
  ...jest.requireActual("../../api/stream-chat"),
  streamChat: jest.fn(),
}));
jest.mock("@/shared/lib/hooks/useHydratedSession", () => ({
  useHydratedSession: () => ({ data: { tenantId: "keep" } }),
}));

const get = jest.fn();
const getToken = () => "token";
const streamMock = streamChat as jest.Mock;

const context: ChatContext = {
  page: "/alerts/feed",
  selected_fingerprints: ["fp-1"],
  selected_count: 1,
};
const CONVERSATION = golden.conversations.finished.id;
const finished = golden.conversations.finished as unknown as ConversationView;
const empty: ConversationView = { ...finished, items: [], has_more: false };
const events = (name: keyof typeof golden.streams) =>
  golden.streams[name].events as StreamEvent[];

const refusal = (name: keyof typeof golden.errors, retryAfter = null) => {
  const { status, body } = golden.errors[name];
  return new AssistantChatError(body.detail, "/x", body, status, retryAfter);
};

/** One call of the stream client, driven by the test. */
interface Call {
  params: StreamChatParams;
  resolve: () => void;
  reject: (error: unknown) => void;
}
let calls: Call[];

const store = useAssistantPanelStore;
const storedId = () => store.getState().conversationIdByTenant.keep;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

function setup() {
  let renders = 0;
  const hook = renderHook(
    () => {
      renders += 1;
      return useAssistantChat();
    },
    { wrapper }
  );
  return { ...hook, getRenders: () => renders };
}

const advance = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));

type Chat = { result: { current: ReturnType<typeof useAssistantChat> } };

async function send({ result }: Chat, message = "acknowledge these") {
  let accepted: boolean | undefined;
  await act(async () => {
    result.current.send(message, context).then((value) => {
      accepted = value;
    });
  });
  return { isAccepted: () => accepted };
}

const emit = (stream: StreamEvent[], call = calls[calls.length - 1]) =>
  act(async () => stream.forEach(call.params.onEvent));
const end = (call = calls[calls.length - 1]) => act(async () => call.resolve());
const fail = (error: unknown, call = calls[calls.length - 1]) =>
  act(async () => call.reject(error));

const texts = ({ result }: Chat) =>
  result.current.entries.flatMap((entry) =>
    entry.type === "message" ? [`${entry.role}: ${entry.content}`] : []
  );

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  store.setState(store.getInitialState(), true);
  localStorage.clear();
  get.mockReset();
  get.mockResolvedValue(empty);
  // The global mock has no getToken
  (useApi as jest.Mock).mockReturnValue({ isReady: () => true, get, getToken });
  calls = [];
  streamMock.mockImplementation(
    (params: StreamChatParams) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ params, resolve, reject });
        params.signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      })
  );
});

afterEach(() => {
  jest.useRealTimers();
});

describe("sending", () => {
  it("starts a conversation and remembers it for the tenant", async () => {
    const chat = setup();
    await send(chat, "  hello\0 ");
    expect(calls[0].params.request).toEqual({
      conversation_id: null,
      message: "hello",
      context,
    });
    expect(calls[0].params.api.getToken()).toBe("token");
    expect(chat.result.current.isStreaming).toBe(true);
    expect(texts(chat)).toEqual(["user: hello"]);

    await emit(events("draft_created").slice(0, 1));
    expect(storedId()).toBe(CONVERSATION);
  });

  it("continues the stored conversation", async () => {
    store.getState().setConversationId("keep", CONVERSATION);
    store.getState().setConversationId("other", "c-9");
    const chat = setup();
    await advance(0);
    await send(chat);
    expect(calls[0].params.request.conversation_id).toBe(CONVERSATION);
  });

  it.each([[""], ["   "], ["\0"]])("does not send %j", async (message) => {
    const chat = setup();
    const { isAccepted } = await send(chat, message);
    expect(isAccepted()).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("does not send a second message during a turn", async () => {
    const chat = setup();
    await send(chat);
    const { isAccepted } = await send(chat, "another");
    expect(isAccepted()).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe("a turn that ends", () => {
  it("is shown live, then taken from the stored conversation", async () => {
    const chat = setup();
    const { isAccepted } = await send(chat);
    await emit(events("draft_created"));
    expect(chat.result.current.entries.map(({ key }) => key)).toEqual([
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000004",
      "tool-call_1",
      "draft-00000000-0000-4000-8000-000000000010",
      "00000000-0000-4000-8000-000000000005",
    ]);

    get.mockResolvedValue(finished);
    await end();
    expect(isAccepted()).toBe(true);
    expect(chat.result.current.isStreaming).toBe(false);
    expect(chat.result.current.error).toBeNull();
    expect(chat.result.current.hasMore).toBe(true);
    expect(chat.result.current.entries.map(({ key }) => key)).toEqual([
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000004",
      "draft-00000000-0000-4000-8000-000000000014",
      "00000000-0000-4000-8000-000000000005",
    ]);
  });

  it("stays on screen when the stored conversation cannot be read", async () => {
    const chat = setup();
    await send(chat);
    await emit(events("draft_created"));
    get.mockRejectedValue(new Error("500"));
    await end();
    expect(chat.result.current.isStreaming).toBe(false);
    expect(chat.result.current.entries).toHaveLength(5);
  });

  it("is not awaited again when the server still holds its lock", async () => {
    const chat = setup();
    await send(chat);
    get.mockResolvedValue({ ...finished, turn_in_progress: true });
    await emit(events("draft_created"));
    await end();
    expect(chat.result.current.isAnswering).toBe(false);
    const { length } = get.mock.calls;
    await advance(10_000);
    expect(get).toHaveBeenCalledTimes(length);
  });

  it.each([
    "llm_unavailable",
    "llm_rejected",
    "llm_rate_limited",
    "turn_timeout",
    "gateway_unavailable",
    "unauthenticated",
    "internal",
  ] as const)("shows the error %s of the stream", async (code) => {
    const chat = setup();
    const { isAccepted } = await send(chat);
    const stream = events(`error_${code}`);
    await emit(stream);
    get.mockResolvedValue(finished);
    await end();
    const message = stream.flatMap((event) =>
      event.event === "error" ? [event.data.message] : []
    )[0];
    expect(chat.result.current.error).toEqual({
      code,
      message,
      retryAfterSeconds: null,
    });
    // The message was stored, so it does not go back to the composer
    expect(isAccepted()).toBe(true);

    await send(chat, "again");
    expect(chat.result.current.error).toBeNull();
  });
});

describe("text deltas", () => {
  const delta = (text: string): StreamEvent => ({
    event: "text_delta",
    data: { message_id: "m-1", delta: text },
  });

  it("are shown together every 50 ms", async () => {
    const chat = setup();
    await send(chat);
    const before = chat.getRenders();
    await emit(Array.from({ length: 40 }, () => delta("a")));
    expect(chat.getRenders()).toBe(before);

    await advance(DELTA_FLUSH_MS - 1);
    expect(texts(chat)).toEqual(["user: acknowledge these"]);
    await advance(1);
    expect(texts(chat)[1]).toBe(`assistant: ${"a".repeat(40)}`);
    expect(chat.getRenders()).toBe(before + 1);
  });

  it("are shown before any event that follows them", async () => {
    const chat = setup();
    await send(chat);
    await emit([
      delta("before "),
      {
        event: "tool_status",
        data: {
          tool_call_id: "call_1",
          tool: "change_alert_status",
          phase: "started",
          label: "Preparing",
        },
      },
    ]);
    expect(chat.result.current.entries.map(({ type }) => type)).toEqual([
      "message",
      "message",
      "tool",
    ]);
  });

  it("never reach local storage", async () => {
    const chat = setup();
    await send(chat, "a secret question");
    await emit([
      ...events("draft_created").slice(0, 1),
      delta("secret answer"),
    ]);
    await advance(DELTA_FLUSH_MS);
    expect(JSON.stringify({ ...localStorage })).not.toContain("secret");
  });
});

describe("a turn that breaks", () => {
  const broken = new StreamBrokenError("truncated");
  const inProgress: ConversationView = {
    ...empty,
    turn_in_progress: true,
    items: finished.items.slice(0, 1),
  };

  it("keeps its text as interrupted, and waits for the server", async () => {
    const chat = setup();
    const { isAccepted } = await send(chat);
    await emit(events("truncated"));
    get.mockResolvedValue(inProgress);
    await fail(broken);

    expect(isAccepted()).toBe(true);
    expect(chat.result.current.isStreaming).toBe(false);
    expect(chat.result.current.isAnswering).toBe(true);
    expect(chat.result.current.error?.message).toMatch(/interrupted/);
    const last = chat.result.current.entries.slice(-1)[0];
    expect(last).toMatchObject({ role: "assistant", status: "interrupted" });

    get.mockResolvedValue(finished);
    await advance(3_000);
    expect(chat.result.current.isAnswering).toBe(false);
    expect(chat.result.current.entries).toHaveLength(finished.items.length);
  });

  it("keeps the stream's own error when there was one", async () => {
    const chat = setup();
    await send(chat);
    await emit(events("error_internal").slice(0, 2));
    await fail(broken);
    expect(chat.result.current.error?.code).toBe("internal");
  });

  it("refetches even after the watchdog fired", async () => {
    const chat = setup();
    await send(chat);
    await emit(events("truncated"));
    const { length } = get.mock.calls;
    await fail(new StreamBrokenError("timeout"));
    expect(get).toHaveBeenCalledTimes(length + 1);
  });
});

describe("a refused message", () => {
  it("goes back to the composer with the server's reason", async () => {
    const chat = setup();
    const { isAccepted } = await send(chat);
    await fail(refusal("rate_limited", 30 as never));
    expect(isAccepted()).toBe(false);
    expect(chat.result.current.error).toEqual({
      code: "rate_limited",
      message: golden.errors.rate_limited.body.detail,
      retryAfterSeconds: 30,
    });
    expect(chat.result.current.entries).toEqual([]);
    expect(chat.result.current.isStreaming).toBe(false);
  });

  it("is not stored, so nothing is refetched", async () => {
    store.getState().setConversationId("keep", CONVERSATION);
    const chat = setup();
    await advance(0);
    const { length } = get.mock.calls;
    await send(chat);
    await fail(refusal("forbidden"));
    expect(get).toHaveBeenCalledTimes(length);
  });

  it("waits while another turn is in progress", async () => {
    store.getState().setConversationId("keep", CONVERSATION);
    const chat = setup();
    await advance(0);
    get.mockResolvedValue({ ...empty, turn_in_progress: true });
    const { isAccepted } = await send(chat);
    await fail(refusal("turn_in_progress"));

    expect(isAccepted()).toBe(false);
    expect(chat.result.current.isAnswering).toBe(true);
    expect(chat.result.current.error).toBeNull();

    get.mockResolvedValue(finished);
    await advance(3_000);
    expect(chat.result.current.isAnswering).toBe(false);
  });

  it("says so when the other turn ended in the meantime", async () => {
    store.getState().setConversationId("keep", CONVERSATION);
    const chat = setup();
    await advance(0);
    await send(chat);
    await fail(refusal("turn_in_progress"));
    expect(chat.result.current.isAnswering).toBe(false);
    expect(chat.result.current.error?.code).toBe("turn_in_progress");
  });
});

describe("a conversation that is gone", () => {
  it("is forgotten, and the message starts a new one", async () => {
    store.getState().setConversationId("keep", "c-old");
    const chat = setup();
    await advance(0);
    const { isAccepted } = await send(chat);
    await fail(refusal("conversation_not_found"));
    expect(storedId()).toBeUndefined();
    expect(calls).toHaveLength(2);
    expect(calls[1].params.request.conversation_id).toBeNull();

    await emit(events("cancelled"));
    expect(storedId()).toBe(CONVERSATION);
    await end();
    expect(isAccepted()).toBe(true);
  });

  it("is not retried twice", async () => {
    store.getState().setConversationId("keep", "c-old");
    const chat = setup();
    await advance(0);
    const { isAccepted } = await send(chat);
    await fail(refusal("conversation_not_found"));
    await fail(refusal("conversation_not_found"));
    expect(calls).toHaveLength(2);
    expect(isAccepted()).toBe(false);
  });

  it("is forgotten when it cannot be read", async () => {
    store.getState().setConversationId("keep", "c-old");
    store.getState().setConversationId("other", "c-9");
    const { status, body } = golden.errors.conversation_not_found;
    get.mockRejectedValue(
      new KeepApiError(body.detail, "/x", "", body, status)
    );
    setup();
    await advance(0);
    expect(store.getState().conversationIdByTenant).toEqual({ other: "c-9" });
  });
});

describe("an unknown outcome", () => {
  const stored = (content: string): ConversationView => ({
    ...empty,
    items: [
      {
        type: "message",
        id: "m-new",
        role: "user",
        content,
        status: "complete",
        created_at: "2026-11-24T10:00:00+00:00",
      },
    ],
  });

  it.each([
    ["a network error", new TypeError("Failed to fetch")],
    ["a plain-text 500", new Error("An error occurred")],
    ["a JSON 500", refusal("internal")],
  ])("after %s is settled by the conversation", async (_, error) => {
    store.getState().setConversationId("keep", CONVERSATION);
    const chat = setup();
    await advance(0);

    get.mockResolvedValue(stored("acknowledge these"));
    const first = await send(chat);
    await fail(error);
    expect(first.isAccepted()).toBe(true);
    expect(chat.result.current.error?.message).toMatch(/interrupted/);

    // The same text again: the message already there is not this one
    const second = await send(chat);
    await fail(error);
    expect(second.isAccepted()).toBe(false);
    expect(chat.result.current.error).not.toBeNull();
    expect(chat.result.current.entries).toHaveLength(1);
  });

  it("gives the message back when there is no conversation to look at", async () => {
    const chat = setup();
    const { isAccepted } = await send(chat);
    await fail(new TypeError("Failed to fetch"));
    expect(isAccepted()).toBe(false);
    expect(chat.result.current.error).toEqual({
      code: null,
      message: "The assistant could not be reached. Try again.",
      retryAfterSeconds: null,
    });
  });
});

describe("startNew", () => {
  it("leaves the conversation and aborts the turn", async () => {
    const chat = setup();
    await send(chat);
    await emit(events("draft_created").slice(0, 3));
    await act(async () => chat.result.current.startNew());

    expect(calls[0].params.signal.aborted).toBe(true);
    expect(storedId()).toBeUndefined();
    expect(chat.result.current).toMatchObject({
      entries: [],
      isStreaming: false,
      error: null,
    });

    // Whatever the old stream still sends
    await emit(events("draft_created"), calls[0]);
    await advance(DELTA_FLUSH_MS);
    expect(storedId()).toBeUndefined();
    expect(chat.result.current.entries).toEqual([]);

    await send(chat, "hello again");
    expect(calls[1].params.request.conversation_id).toBeNull();
    expect(texts(chat)).toEqual(["user: hello again"]);
  });
});

it("aborts the turn when the panel goes away for good", async () => {
  const chat = setup();
  await send(chat);
  chat.unmount();
  expect(calls[0].params.signal.aborted).toBe(true);
});

it("shows a replaced draft, live and stored", async () => {
  const chat = setup();
  await send(chat);
  await emit(events("draft_created"));
  const discarded = {
    ...golden.drafts.pending,
    state: "discarded",
  } as unknown as DraftView;
  await act(async () => chat.result.current.replaceDraft(discarded));
  expect(chat.result.current.entries[3]).toMatchObject({ draft: discarded });

  get.mockResolvedValue({
    ...finished,
    items: [
      finished.items[0],
      { type: "draft", draft: golden.drafts.pending as unknown as DraftView },
    ],
  });
  await end();
  await act(async () => chat.result.current.replaceDraft(discarded));
  expect(chat.result.current.entries[1]).toMatchObject({ draft: discarded });
});
