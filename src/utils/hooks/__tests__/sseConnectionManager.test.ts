import { TextDecoder, TextEncoder } from "util";
import {
  ensureSSEConnected,
  bindSSEHandler,
  unbindSSEHandler,
  __resetSSEManagerForTests,
} from "../sseConnectionManager";

// jsdom does not expose TextDecoder/TextEncoder, which the SSE read loop uses.
(global as any).TextDecoder = (global as any).TextDecoder || TextDecoder;
(global as any).TextEncoder = (global as any).TextEncoder || TextEncoder;

/**
 * jsdom does not implement BroadcastChannel or navigator.locks, so we inject
 * mocks to exercise the two code paths of the connection manager:
 *  - coordinated mode: a follower tab dispatches events received over the
 *    BroadcastChannel to its local handlers;
 *  - fallback mode: when the coordination APIs are missing, the tab opens its
 *    own SSE fetch stream.
 */

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

  // Test helper: simulate a message arriving from another (leader) tab.
  emit(data: any) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const originalBroadcastChannel = (global as any).BroadcastChannel;
const originalFetch = global.fetch;

function setLocks(value: any) {
  Object.defineProperty(navigator, "locks", {
    value,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  __resetSSEManagerForTests();
  MockBroadcastChannel.instances = [];
  (global as any).BroadcastChannel = originalBroadcastChannel;
  global.fetch = originalFetch;
  setLocks(undefined);
  jest.clearAllMocks();
});

describe("sseConnectionManager — coordinated (follower) mode", () => {
  beforeEach(() => {
    (global as any).BroadcastChannel = MockBroadcastChannel;
    // Follower: requesting the lock never grants it (the callback never runs),
    // so this tab never opens its own fetch stream.
    setLocks({ request: jest.fn(() => new Promise(() => {})) });
  });

  it("dispatches events broadcast by the leader to local handlers", () => {
    ensureSSEConnected({ token: "tkn", apiUrl: "https://api.example.com" });

    const handler = jest.fn();
    bindSSEHandler("poll-alerts", handler);

    const channel = MockBroadcastChannel.instances.find(
      (c) => c.name === "keep-sse"
    );
    expect(channel).toBeDefined();

    channel!.emit({
      kind: "keep-sse-event",
      eventType: "poll-alerts",
      data: { fingerprint: "abc" },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ fingerprint: "abc" });
  });

  it("ignores foreign messages and stops dispatching after unbind", () => {
    ensureSSEConnected({ token: "tkn", apiUrl: "https://api.example.com" });

    const handler = jest.fn();
    bindSSEHandler("poll-alerts", handler);
    const channel = MockBroadcastChannel.instances.find(
      (c) => c.name === "keep-sse"
    )!;

    // Unrelated message shape is ignored.
    channel.emit({ kind: "something-else", eventType: "poll-alerts", data: 1 });
    expect(handler).not.toHaveBeenCalled();

    unbindSSEHandler("poll-alerts", handler);
    channel.emit({ kind: "keep-sse-event", eventType: "poll-alerts", data: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not open its own fetch stream while a follower", () => {
    global.fetch = jest.fn();
    ensureSSEConnected({ token: "tkn", apiUrl: "https://api.example.com" });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("sseConnectionManager — fallback (no coordination) mode", () => {
  beforeEach(() => {
    delete (global as any).BroadcastChannel;
    setLocks(undefined);
  });

  it("opens a per-tab SSE fetch with the bearer token when APIs are unavailable", async () => {
    const reader = { read: jest.fn(() => new Promise(() => {})) }; // never yields
    const fetchMock = jest.fn(() =>
      Promise.resolve({ ok: true, body: { getReader: () => reader } } as any)
    );
    global.fetch = fetchMock as any;

    ensureSSEConnected({ token: "my-token", apiUrl: "https://api.example.com" });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as any[];
    expect(url).toBe("https://api.example.com/sse/subscribe");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer my-token");
  });

  it("omits the Authorization header for an unauthenticated session", async () => {
    const reader = { read: jest.fn(() => new Promise(() => {})) };
    const fetchMock = jest.fn(() =>
      Promise.resolve({ ok: true, body: { getReader: () => reader } } as any)
    );
    global.fetch = fetchMock as any;

    ensureSSEConnected({
      token: "unauthenticated",
      apiUrl: "https://api.example.com",
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as any[];
    expect(init.headers.Authorization).toBeUndefined();
  });
});
