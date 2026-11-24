/**
 * @jest-environment node
 */
import { signOut } from "next-auth/react";
import { KeepApiError } from "@/shared/api";
import { clearAssistantStorage } from "@/shared/lib/assistant-storage";
import { recordAction, recordError } from "@/utils/metrics";
import golden from "../../__fixtures__/assistant_stream.json";
import { ChatRequest, StreamEvent } from "../../model/types";
import { getAssistantError } from "../assistant-error";
import {
  STREAM_IDLE_TIMEOUT_MS,
  StreamBrokenError,
  streamChat,
} from "../stream-chat";

jest.mock("next-auth/react", () => ({ signOut: jest.fn() }));
jest.mock("@/shared/lib/assistant-storage", () => ({
  clearAssistantStorage: jest.fn(),
}));
jest.mock("@/utils/metrics", () => ({
  recordAction: jest.fn(),
  recordError: jest.fn(),
}));

const request: ChatRequest = {
  conversation_id: null,
  message: "acknowledge these",
  context: {
    page: "/alerts/feed",
    selected_fingerprints: ["fp-1"],
    selected_count: 1,
  },
};

const fetchMock = jest.fn();
const encoder = new TextEncoder();

/** A response body the test writes to while the client reads it. */
function openStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = jest.fn();
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
    cancel,
  });
  return {
    response: new Response(body, {
      status: 200,
      headers: golden.response_headers,
    }),
    write: (data: string | Uint8Array) =>
      controller.enqueue(
        typeof data === "string" ? encoder.encode(data) : data
      ),
    close: () => controller.close(),
    fail: () => controller.error(new TypeError("network error")),
    cancel,
  };
}

const textResponse = (raw: string) =>
  new Response(raw, { status: 200, headers: golden.response_headers });

const errorResponse = (name: keyof typeof golden.errors) => {
  const { status, headers, body } = golden.errors[name];
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...(headers as Record<string, string>),
    },
  });
};

function start(token: string | undefined = "token") {
  const events: StreamEvent[] = [];
  const abortController = new AbortController();
  const settled = streamChat({
    api: { getToken: () => token },
    request,
    signal: abortController.signal,
    onEvent: (event) => events.push(event),
  }).then(
    () => ({ error: null }),
    (error: unknown) => ({ error })
  );
  return {
    events,
    settled,
    abort: (why?: unknown) => abortController.abort(why),
  };
}

const flush = () => jest.advanceTimersByTimeAsync(0);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  global.fetch = fetchMock;
});

afterEach(() => {
  jest.useRealTimers();
});

describe("the request", () => {
  beforeEach(() => {
    fetchMock.mockImplementation(async () =>
      textResponse(golden.streams.cancelled.raw)
    );
  });

  it("posts the turn to the same-origin proxy with the token", async () => {
    await start("keepActiveTenant=keep&jwt").settled;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/backend/assistant/chat");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(request);
    expect(init.headers).toEqual({
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Authorization: "Bearer keepActiveTenant=keep&jwt",
    });
  });

  it.each([["unauthenticated"], [""]])(
    "sends no Authorization for the token %j",
    async (token) => {
      await start(token).settled;
      expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
        "Authorization"
      );
    }
  );

  it("sends no Authorization while the session is loading", async () => {
    await streamChat({
      api: { getToken: () => undefined },
      request,
      signal: new AbortController().signal,
      onEvent: () => {},
    });
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
      "Authorization"
    );
  });
});

describe("a stream that ends with done", () => {
  it.each(Object.keys(golden.streams).filter((name) => name !== "truncated"))(
    "reports every event of %s",
    async (name) => {
      const stream = golden.streams[name as keyof typeof golden.streams];
      fetchMock.mockResolvedValue(textResponse(stream.raw));
      const turn = start();

      expect((await turn.settled).error).toBeNull();
      expect(turn.events).toEqual(stream.events);
      expect(recordAction).toHaveBeenCalledWith(
        "assistant_message",
        expect.any(Number)
      );
      expect(recordError).not.toHaveBeenCalled();
    }
  );

  it("reports events while the stream is still open", async () => {
    const stream = openStream();
    fetchMock.mockResolvedValue(stream.response);
    const turn = start();
    await flush();

    const raw = golden.streams.draft_created.raw;
    const middle = raw.indexOf("the selected alerts.");
    stream.write(raw.slice(0, middle));
    await flush();
    expect(turn.events).toEqual(
      golden.streams.draft_created.events.slice(0, 2)
    );

    stream.write(raw.slice(middle));
    await turn.settled;
    expect(turn.events).toEqual(golden.streams.draft_created.events);
  });

  it("survives a multi-byte character split over two chunks", async () => {
    const stream = openStream();
    fetchMock.mockResolvedValue(stream.response);
    const turn = start();
    await flush();

    const frame = encoder.encode(
      'event: text_delta\ndata: {"message_id": "m", "delta": "é"}\n\n'
    );
    const cut = frame.indexOf(0xc3) + 1;
    stream.write(frame.slice(0, cut));
    await flush();
    stream.write(frame.slice(cut));
    await flush();
    expect(turn.events).toEqual([
      { event: "text_delta", data: { message_id: "m", delta: "é" } },
    ]);
    turn.abort();
    await turn.settled;
  });

  it("lets go of the connection at done, even when the server keeps it", async () => {
    const stream = openStream();
    fetchMock.mockResolvedValue(stream.response);
    const turn = start();
    await flush();
    stream.write(golden.streams.cancelled.raw);

    expect((await turn.settled).error).toBeNull();
    expect(stream.cancel).toHaveBeenCalled();
  });
});

describe("a stream that breaks", () => {
  it.each(["closes", "fails"])(
    "is truncated when the connection %s without done",
    async (how) => {
      const stream = openStream();
      fetchMock.mockResolvedValue(stream.response);
      const turn = start();
      await flush();
      stream.write(golden.streams.truncated.raw);
      await flush();
      if (how === "closes") {
        stream.close();
      } else {
        stream.fail();
      }

      const { error } = await turn.settled;
      expect(error).toBeInstanceOf(StreamBrokenError);
      expect((error as StreamBrokenError).reason).toBe("truncated");
      expect(turn.events).toEqual(golden.streams.truncated.events);
      expect((recordError as jest.Mock).mock.calls).toEqual([
        ["assistant_stream_truncated"],
      ]);
      expect(recordAction).not.toHaveBeenCalled();
    }
  );

  it("times out after 45 s without a byte", async () => {
    const stream = openStream();
    fetchMock.mockResolvedValue(stream.response);
    const turn = start();
    await flush();
    stream.write("event: text_delta\n");
    await flush();

    await jest.advanceTimersByTimeAsync(STREAM_IDLE_TIMEOUT_MS - 1);
    expect(recordError).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    const { error } = await turn.settled;
    expect((error as StreamBrokenError).reason).toBe("timeout");
    expect((recordError as jest.Mock).mock.calls).toEqual([
      ["assistant_stream_timeout"],
    ]);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(stream.cancel).toHaveBeenCalled();
  });

  it("is kept alive by heartbeats", async () => {
    const stream = openStream();
    fetchMock.mockResolvedValue(stream.response);
    const turn = start();
    await flush();
    for (let beat = 0; beat < 12; beat++) {
      stream.write(golden.heartbeat);
      await jest.advanceTimersByTimeAsync(10_000);
    }
    expect(recordError).not.toHaveBeenCalled();

    stream.write(golden.streams.cancelled.raw);
    expect((await turn.settled).error).toBeNull();
  });

  it("times out when no response ever comes", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const turn = start();
    await jest.advanceTimersByTimeAsync(STREAM_IDLE_TIMEOUT_MS);
    const { error } = await turn.settled;
    expect((error as StreamBrokenError).reason).toBe("timeout");
  });

  it("reports a network error before the response as unknown", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { error } = await start().settled;
    expect(error).toBeInstanceOf(TypeError);
    expect(getAssistantError(error)).toBeNull();
    expect((recordError as jest.Mock).mock.calls).toEqual([
      ["assistant_message"],
    ]);
  });
});

describe("an abort by the caller", () => {
  it("rejects with the reason, closes the connection and counts nothing", async () => {
    const stream = openStream();
    fetchMock.mockResolvedValue(stream.response);
    const turn = start();
    await flush();
    turn.abort("closed");

    expect((await turn.settled).error).toBe("closed");
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(stream.cancel).toHaveBeenCalled();
    expect(recordError).not.toHaveBeenCalled();
    expect(recordAction).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("does not send a turn that was aborted before it started", async () => {
    const abortController = new AbortController();
    abortController.abort("closed");
    await expect(
      streamChat({
        api: { getToken: () => "token" },
        request,
        signal: abortController.signal,
        onEvent: () => {},
      })
    ).rejects.toBe("closed");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("a refused message", () => {
  it.each(Object.keys(golden.errors) as (keyof typeof golden.errors)[])(
    "raises %s with its code and status",
    async (name) => {
      const golden_error = golden.errors[name];
      fetchMock.mockResolvedValue(errorResponse(name));
      const { error } = await start().settled;

      expect(error).toBeInstanceOf(KeepApiError);
      expect(getAssistantError(error)).toMatchObject({
        code: golden_error.body.errors[0].code,
        message: golden_error.body.errors[0].message,
        status: golden_error.status,
      });
      expect((recordError as jest.Mock).mock.calls).toEqual([
        ["assistant_message", golden_error.status],
      ]);
    }
  );

  it("carries Retry-After", async () => {
    fetchMock.mockResolvedValue(errorResponse("rate_limited"));
    const { error } = await start().settled;
    expect(getAssistantError(error)?.retryAfterSeconds).toBe(30);
  });

  it("has no Retry-After when the header is a date", async () => {
    const response = errorResponse("turn_in_progress");
    response.headers.set("retry-after", "Wed, 21 Oct 2026 07:28:00 GMT");
    fetchMock.mockResolvedValue(response);
    const { error } = await start().settled;
    expect(getAssistantError(error)?.retryAfterSeconds).toBeNull();
  });

  it("signs out on a 401", async () => {
    fetchMock.mockResolvedValue(errorResponse("unauthenticated"));
    await start().settled;
    expect(clearAssistantStorage).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("stays signed in on any other status", async () => {
    fetchMock.mockResolvedValue(errorResponse("forbidden"));
    await start().settled;
    expect(clearAssistantStorage).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it.each([
    ["Next's plain-text 500", "text/plain", "Internal Server Error", 500],
    ["a proxy's HTML 502", "text/html", "<html></html>", 502],
    ["JSON that does not parse", "application/json", "{", 500],
  ])("treats %s as unknown", async (_, contentType, body, status) => {
    fetchMock.mockResolvedValue(
      new Response(body, { status, headers: { "content-type": contentType } })
    );
    const { error } = await start().settled;
    expect(error).toBeInstanceOf(Error);
    expect(getAssistantError(error)).toBeNull();
    expect(recordError).toHaveBeenCalledWith("assistant_message", status);
  });

  it("reads the middleware's 503", async () => {
    const message = "Keep Assistant is not configured";
    fetchMock.mockResolvedValue(
      Response.json(
        {
          errors: [{ field: null, code: "assistant_not_configured", message }],
          detail: message,
        },
        { status: 503 }
      )
    );
    const { error } = await start().settled;
    expect(getAssistantError(error)).toMatchObject({
      code: "assistant_not_configured",
      message,
      status: 503,
    });
  });
});

describe("getAssistantError", () => {
  it("returns the draft of a 409", () => {
    const { body, status } = golden.errors.draft_not_pending;
    const error = new KeepApiError(body.detail, "/x", "", body, status);
    expect(getAssistantError(error)?.draft).toEqual(body.draft);
  });

  it("falls back to the error's own message without an errors list", () => {
    const error = new KeepApiError("nope", "/x", "", { detail: "nope" }, 500);
    expect(getAssistantError(error)).toEqual({
      code: null,
      message: "nope",
      status: 500,
      retryAfterSeconds: null,
      draft: null,
    });
  });

  it.each([[null], ["text"], [undefined]])("survives the body %j", (body) => {
    const error = new KeepApiError("nope", "/x", "", body, 500);
    expect(getAssistantError(error)?.code).toBeNull();
  });
});
