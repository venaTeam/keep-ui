import { TextDecoder, TextEncoder } from "util";
import {
  ensureSSEConnected,
  bindSSEHandler,
  __resetSSEManagerForTests,
} from "../sseConnectionManager";

(global as any).TextDecoder = (global as any).TextDecoder || TextDecoder;
(global as any).TextEncoder = (global as any).TextEncoder || TextEncoder;

/**
 * Resilience of the shared SSE stream: a stream that goes silent is dropped
 * and reopened, a gateway that is down for longer than any retry budget is
 * still reconnected to when it returns, a reconnect asks open views to catch
 * up, and leadership is scoped per tenant.
 *
 * Streams are simulated with a scripted reader: each `read()` resolves with
 * the next queued chunk, or parks until `push()`/`end()` is called.
 */

const API = "https://api.example.com";
const encoder = new TextEncoder();

type Chunk = { done: boolean; value?: Uint8Array };

function scriptedStream() {
  const queue: Chunk[] = [];
  let pending: {
    resolve: (r: Chunk) => void;
    reject: (e: Error) => void;
  } | null = null;
  let aborted = false;
  const deliver = (r: Chunk) => {
    if (pending) {
      const { resolve } = pending;
      pending = null;
      resolve(r);
    } else {
      queue.push(r);
    }
  };
  return {
    reader: {
      read: () =>
        new Promise<Chunk>((resolve, reject) => {
          if (aborted) {
            reject(new DOMException("aborted", "AbortError"));
          } else if (queue.length) {
            resolve(queue.shift()!);
          } else {
            pending = { resolve, reject };
          }
        }),
    },
    attach: (signal: AbortSignal) =>
      signal.addEventListener("abort", () => {
        aborted = true;
        pending?.reject(new DOMException("aborted", "AbortError"));
        pending = null;
      }),
    push: (text: string) =>
      deliver({ done: false, value: encoder.encode(text) }),
    end: () => deliver({ done: true }),
  };
}

const connectedBlock = 'event: connected\ndata: {"status":"connected"}\n\n';

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
};

const advance = async (ms: number) => {
  jest.advanceTimersByTime(ms);
  await flush();
};

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  name: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage = jest.fn();
  close = jest.fn();

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  emit(data: any) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

const originalBroadcastChannel = (global as any).BroadcastChannel;
const originalFetch = global.fetch;

function setLocks(value: any) {
  Object.defineProperty(navigator, "locks", {
    value,
    configurable: true,
    writable: true,
  });
}

function fetchReturning(streams: Array<ReturnType<typeof scriptedStream>>) {
  let calls = 0;
  const controllers: AbortSignal[] = [];
  const fetchMock = jest.fn((_url: string, init: any) => {
    controllers.push(init.signal);
    const stream = streams[Math.min(calls, streams.length - 1)];
    calls++;
    stream.attach(init.signal);
    return new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError"))
      );
      resolve({ ok: true, body: { getReader: () => stream.reader } });
    });
  });
  return { fetchMock, signals: controllers };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, "random").mockReturnValue(0);
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  __resetSSEManagerForTests();
  MockBroadcastChannel.instances = [];
  (global as any).BroadcastChannel = originalBroadcastChannel;
  global.fetch = originalFetch;
  setLocks(undefined);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("sseConnectionManager — standalone stream resilience", () => {
  beforeEach(() => {
    delete (global as any).BroadcastChannel;
    setLocks(undefined);
  });

  it("aborts a stream that stops sending bytes and opens a new one", async () => {
    const silent = scriptedStream();
    const replacement = scriptedStream();
    const { fetchMock, signals } = fetchReturning([silent, replacement]);
    global.fetch = fetchMock as any;

    ensureSSEConnected({ token: "tkn", apiUrl: API });
    await flush();
    silent.push(connectedBlock);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(30_000);
    expect(signals[0].aborted).toBe(false);

    await advance(30_000);
    expect(signals[0].aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts a connect that never returns headers and tries again", async () => {
    const live = scriptedStream();
    let calls = 0;
    const signals: AbortSignal[] = [];
    const fetchMock = jest.fn((_url: string, init: any) => {
      calls++;
      signals.push(init.signal);
      if (calls === 1) {
        return new Promise((_resolve, reject) =>
          init.signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          )
        );
      }
      live.attach(init.signal);
      return Promise.resolve({
        ok: true,
        body: { getReader: () => live.reader },
      });
    });
    global.fetch = fetchMock as any;

    ensureSSEConnected({ token: "tkn", apiUrl: API });
    await flush();
    await advance(30_000);
    expect(signals[0].aborted).toBe(false);

    await advance(30_000);
    expect(signals[0].aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps reconnecting past ten failures and connects when the gateway returns", async () => {
    let failures = 0;
    const live = scriptedStream();
    const fetchMock = jest.fn((_url: string, init: any) => {
      if (failures < 15) {
        failures++;
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({
        ok: true,
        body: { getReader: () => live.reader },
      });
    });
    global.fetch = fetchMock as any;
    const onConnected = jest.fn();
    bindSSEHandler("connected", onConnected);

    ensureSSEConnected({ token: "tkn", apiUrl: API });
    for (let i = 0; i < 20 && onConnected.mock.calls.length === 0; i++) {
      await advance(31_000);
    }

    expect(fetchMock).toHaveBeenCalledTimes(16);
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("asks open views to catch up after a reconnect but not on the first connect", async () => {
    const first = scriptedStream();
    const second = scriptedStream();
    const { fetchMock } = fetchReturning([first, second]);
    global.fetch = fetchMock as any;
    const pollAlerts = jest.fn();
    const incidentChange = jest.fn();
    bindSSEHandler("poll-alerts", pollAlerts);
    bindSSEHandler("incident-change", incidentChange);

    ensureSSEConnected({ token: "tkn", apiUrl: API });
    await flush();
    first.push(connectedBlock);
    await flush();
    expect(pollAlerts).not.toHaveBeenCalled();

    first.end();
    await flush();
    await advance(2_000);
    second.push(connectedBlock);
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pollAlerts).toHaveBeenCalledTimes(1);
    expect(incidentChange).toHaveBeenCalledTimes(1);
  });

  it("reconnects immediately when the browser comes back online during a backoff", async () => {
    let failures = 0;
    const live = scriptedStream();
    const fetchMock = jest.fn(() => {
      if (failures < 6) {
        failures++;
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({
        ok: true,
        body: { getReader: () => live.reader },
      });
    });
    global.fetch = fetchMock as any;

    ensureSSEConnected({ token: "tkn", apiUrl: API });
    for (let i = 0; i < 6; i++) {
      await advance(31_000);
    }
    const callsBefore = fetchMock.mock.calls.length;
    expect(callsBefore).toBe(6);

    window.dispatchEvent(new Event("online"));
    await flush();

    expect(fetchMock.mock.calls.length).toBe(callsBefore + 1);
  });
});

describe("sseConnectionManager — expired token on reconnect", () => {
  beforeEach(() => {
    delete (global as any).BroadcastChannel;
    setLocks(undefined);
  });

  it("refreshes the session on a 401 and retries at once with the new token", async () => {
    const live = scriptedStream();
    const fetchMock = jest.fn((_url: string, init: any) => {
      if (init.headers.Authorization === "Bearer stale") {
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        });
      }
      live.attach(init.signal);
      return Promise.resolve({
        ok: true,
        body: { getReader: () => live.reader },
      });
    });
    global.fetch = fetchMock as any;
    const refreshToken = jest.fn(() => Promise.resolve("fresh"));

    ensureSSEConnected({ token: "stale", apiUrl: API, refreshToken });
    await flush();

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1] as any)[1].headers.Authorization).toBe(
      "Bearer fresh"
    );
  });

  it("backs off instead of looping when the refresh returns the same token", async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({ ok: false, status: 401, statusText: "Unauthorized" })
    );
    global.fetch = fetchMock as any;
    const refreshToken = jest.fn(() => Promise.resolve("stale"));

    ensureSSEConnected({ token: "stale", apiUrl: API, refreshToken });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("sseConnectionManager — tenant-scoped leadership", () => {
  let lockRequest: jest.Mock;

  beforeEach(() => {
    (global as any).BroadcastChannel = MockBroadcastChannel;
    lockRequest = jest.fn(
      (_name: string, _opts: any, cb: () => Promise<void>) => cb()
    );
    setLocks({ request: lockRequest });
  });

  it("names the lock and channel after the active tenant", async () => {
    const stream = scriptedStream();
    const { fetchMock } = fetchReturning([stream]);
    global.fetch = fetchMock as any;

    ensureSSEConnected({ token: "tkn", apiUrl: API, tenantId: "org-a" });
    await flush();

    expect(lockRequest.mock.calls[0][0]).toBe("keep-sse-leader:org-a");
    expect(MockBroadcastChannel.instances.map((c) => c.name)).toEqual([
      "keep-sse:org-a",
    ]);
  });

  it("moves leadership to the new tenant scope when the session's tenant changes", async () => {
    const streamA = scriptedStream();
    const streamB = scriptedStream();
    const { fetchMock, signals } = fetchReturning([streamA, streamB]);
    global.fetch = fetchMock as any;
    const handler = jest.fn();
    bindSSEHandler("poll-alerts", handler);

    ensureSSEConnected({ token: "tkn-a", apiUrl: API, tenantId: "org-a" });
    await flush();
    streamA.push(connectedBlock);
    await flush();

    ensureSSEConnected({ token: "tkn-b", apiUrl: API, tenantId: "org-b" });
    await flush();
    await advance(1_000);

    expect(signals[0].aborted).toBe(true);
    expect(lockRequest.mock.calls.map((c) => c[0])).toEqual([
      "keep-sse-leader:org-a",
      "keep-sse-leader:org-b",
    ]);
    const [oldChannel, newChannel] = MockBroadcastChannel.instances;
    expect(oldChannel.close).toHaveBeenCalled();
    expect(newChannel.name).toBe("keep-sse:org-b");

    const dispatchedBefore = handler.mock.calls.length;
    oldChannel.emit({
      kind: "keep-sse-event",
      eventType: "poll-alerts",
      data: 1,
    });
    expect(handler.mock.calls.length).toBe(dispatchedBefore);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1] as any)[1].headers.Authorization).toBe(
      "Bearer tkn-b"
    );
  });

  it("cancels a follower's pending lock request for the old tenant scope", async () => {
    const requests: Array<{ name: string; signal: AbortSignal }> = [];
    lockRequest.mockImplementation((name: string, opts: any) => {
      requests.push({ name, signal: opts.signal });
      return new Promise(() => {});
    });
    global.fetch = jest.fn() as any;

    ensureSSEConnected({ token: "tkn-a", apiUrl: API, tenantId: "org-a" });
    ensureSSEConnected({ token: "tkn-b", apiUrl: API, tenantId: "org-b" });
    await flush();

    expect(requests.map((r) => r.name)).toEqual([
      "keep-sse-leader:org-a",
      "keep-sse-leader:org-b",
    ]);
    expect(requests[0].signal.aborted).toBe(true);
    expect(requests[1].signal.aborted).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

/**
 * Web Locks mock with `steal` semantics: a granted request runs its callback;
 * a later request with `steal: true` rejects the current holder's promise
 * with AbortError and takes over; other requests park until released.
 */
class MockLocks {
  calls: Array<{ name: string; steal: boolean; signal?: AbortSignal }> = [];
  holders = new Map<string, { reject: (e: Error) => void }>();

  request = (name: string, opts: any, cb: () => Promise<void>) => {
    this.calls.push({ name, steal: !!opts.steal, signal: opts.signal });
    return new Promise<void>((resolve, reject) => {
      const abortError = () => new DOMException("aborted", "AbortError");
      opts.signal?.addEventListener("abort", () => reject(abortError()));
      const holder = this.holders.get(name);
      if (holder && !opts.steal) {
        return;
      }
      holder?.reject(abortError());
      this.holders.set(name, { reject });
      cb().then(() => {
        if (this.holders.get(name)?.reject === reject) {
          this.holders.delete(name);
        }
        resolve();
      });
    });
  };
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("sseConnectionManager — leadership follows the visible tab", () => {
  let locks: MockLocks;

  beforeEach(() => {
    (global as any).BroadcastChannel = MockBroadcastChannel;
    locks = new MockLocks();
    setLocks({ request: locks.request });
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it("a follower that becomes visible takes over from a hidden leader and catches up", async () => {
    locks.holders.set("keep-sse-leader:t1", { reject: () => {} });
    const stream = scriptedStream();
    const { fetchMock } = fetchReturning([stream]);
    global.fetch = fetchMock as any;
    const pollAlerts = jest.fn();
    bindSSEHandler("poll-alerts", pollAlerts);

    ensureSSEConnected({ token: "tkn", apiUrl: API, tenantId: "t1" });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    const channel = MockBroadcastChannel.instances[0];
    channel.emit({ kind: "keep-sse-leader-state", visible: false });

    setVisibility("visible");
    await flush();

    expect(locks.calls.map((c) => c.steal)).toEqual([false, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pollAlerts).toHaveBeenCalledTimes(1);
  });

  it("a visible follower leaves a visible leader alone", async () => {
    locks.holders.set("keep-sse-leader:t1", { reject: () => {} });
    global.fetch = jest.fn() as any;

    ensureSSEConnected({ token: "tkn", apiUrl: API, tenantId: "t1" });
    await flush();
    MockBroadcastChannel.instances[0].emit({
      kind: "keep-sse-leader-state",
      visible: true,
    });

    setVisibility("visible");
    await flush();

    expect(locks.calls.map((c) => c.steal)).toEqual([false]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("a leader announces its visibility and stops its stream when the lock is stolen", async () => {
    const stream = scriptedStream();
    const { fetchMock, signals } = fetchReturning([stream]);
    global.fetch = fetchMock as any;

    ensureSSEConnected({ token: "tkn", apiUrl: API, tenantId: "t1" });
    await flush();
    stream.push(connectedBlock);
    await flush();
    const channel = MockBroadcastChannel.instances[0];
    expect(channel.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "keep-sse-leader-state", visible: false })
    );

    locks.request(
      "keep-sse-leader:t1",
      { steal: true },
      () => new Promise(() => {})
    );
    await flush();

    expect(signals[0].aborted).toBe(true);
    await advance(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(locks.calls.map((c) => c.steal)).toEqual([false, true, false]);
  });
});
