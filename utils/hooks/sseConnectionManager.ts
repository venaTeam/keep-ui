/**
 * Cross-tab SSE connection manager.
 *
 * Problem this solves: each browser tab used to open its own long-lived
 * `fetch()` stream to `${API_URL}/sse/subscribe` and never close it. Browsers
 * cap concurrent connections per origin (6 for HTTP/1.1), so a handful of open
 * feed/preset tabs would exhaust the pool and a newly duplicated tab's initial
 * requests (`/preset`, `/alerts/query`, ...) would queue indefinitely — leaving
 * the page stuck on an infinite loading spinner.
 *
 * Fix: collapse the N per-tab connections into a single shared connection per
 * browser. One tab is elected "leader" via an exclusive Web Lock and owns the
 * only SSE stream; it fans every event out to the other tabs over a
 * `BroadcastChannel`. When the leader tab closes, the browser releases its lock
 * and a waiting tab automatically takes over.
 *
 * If `navigator.locks` or `BroadcastChannel` is unavailable (older browsers /
 * insecure context), we fall back to the previous per-tab behavior so realtime
 * still works — just without cross-tab sharing.
 *
 * The React surface (`useSSE`) is a thin wrapper over this module; its public
 * `{ bind, unbind }` API is unchanged.
 */

import {
  SSE_BROADCAST_CHANNEL_NAME,
  SSE_BROADCAST_KIND,
  SSE_LEADER_LOCK_NAME,
  SSE_MAX_RECONNECT_ATTEMPTS,
} from "@/shared/constants";

type SSEHandler = (data: any) => void;

// Event types the backend can send (documentation; handlers are keyed dynamically):
// connected, poll-alerts, incident-change, poll-presets, topology-update,
// ai-logs-change, incident-comment, alert-update

// Handlers are shared across all hook instances in this tab.
const handlers: Map<string, Set<SSEHandler>> = new Map();

// Coordination / connection state (module-level singleton = per tab).
let initialized = false;
let currentToken: string | undefined;
let currentApiUrl: string | undefined;
let connectionAttempts = 0;
let connectionShouldRun = false;
let activeAbort: AbortController | null = null;
let channel: BroadcastChannel | null = null;
let isLeader = false;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function supportsCoordination(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof BroadcastChannel !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.locks &&
    typeof navigator.locks.request === "function"
  );
}

/** Invoke all local handlers bound to an event type in this tab. */
function dispatch(eventType: string, data: any): void {
  const eventHandlers = handlers.get(eventType);
  if (!eventHandlers) {
    return;
  }
  eventHandlers.forEach((handler) => {
    try {
      handler(data);
    } catch (error) {
      console.error(`useSSE: handler for "${eventType}" threw`, error);
    }
  });
}

/**
 * Emit an event: dispatch to this tab's handlers AND, when we own the shared
 * connection, broadcast it to follower tabs. A BroadcastChannel never delivers
 * a message back to the instance that posted it, so the leader does not
 * double-dispatch its own events.
 */
function emit(eventType: string, data: any): void {
  dispatch(eventType, data);
  if (channel) {
    try {
      channel.postMessage({ kind: SSE_BROADCAST_KIND, eventType, data });
    } catch (error) {
      console.error("useSSE: failed to broadcast event to other tabs", error);
    }
  }
}

/** Parse a raw SSE block ("event: x\ndata: y") and emit it. */
function parseAndEmit(block: string): void {
  const lines = block.split("\n");
  let eventType = "message";
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      eventType = line.substring(7).trim();
    } else if (line.startsWith("data: ")) {
      data = line.substring(6).trim();
    }
  }

  if (!eventType || !data) {
    return;
  }

  let payload: any;
  try {
    payload = JSON.parse(data);
  } catch {
    payload = data;
  }
  emit(eventType, payload);
}

/**
 * Owns the single SSE stream. Used by the elected leader and by the standalone
 * fallback path. Reads `currentToken` fresh on every (re)connect so token
 * refreshes are picked up. Loops until `connectionShouldRun` is cleared or the
 * reconnect budget is exhausted.
 */
async function runConnectionLoop(): Promise<void> {
  if (!currentApiUrl) {
    console.error("useSSE: API_URL not configured, cannot establish SSE connection");
    return;
  }
  const sseUrl = `${currentApiUrl}/sse/subscribe`;

  while (connectionShouldRun) {
    const controller = new AbortController();
    activeAbort = controller;
    const token = currentToken;

    try {
      console.log("useSSE: Connecting via fetch...");

      const headers: HeadersInit = {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "ngrok-skip-browser-warning": "true",
      };
      if (token && token !== "unauthenticated") {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(sseUrl, {
        method: "POST",
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `SSE connection failed: ${response.status} ${response.statusText}`
        );
      }
      if (!response.body) {
        throw new Error("SSE connection failed: No body");
      }

      console.log("useSSE: Connected successfully");
      connectionAttempts = 0;
      emit("connected", { status: "connected" });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || ""; // keep incomplete chunk
        for (const block of blocks) {
          parseAndEmit(block);
        }
      }

      // Stream ended (server closed it, e.g. timeout or deploy). Reconnect
      // unless we were intentionally torn down.
      if (!connectionShouldRun) {
        break;
      }
      console.log("useSSE: Stream ended by server, reconnecting...");
      connectionAttempts++;
      if (connectionAttempts >= SSE_MAX_RECONNECT_ATTEMPTS) {
        break;
      }
      await delay(connectionAttempts * 1000);
    } catch (error: any) {
      if (controller.signal.aborted) {
        // Aborted for one of two reasons:
        //  - teardown  -> connectionShouldRun is false, exit the loop
        //  - token change -> reconnect immediately with the new token
        if (!connectionShouldRun) {
          break;
        }
        continue;
      }

      console.error("useSSE: Connection error", error);
      connectionAttempts++;
      if (connectionAttempts >= SSE_MAX_RECONNECT_ATTEMPTS) {
        break;
      }
      console.log(`useSSE: Reconnecting in ${connectionAttempts * 1000}ms...`);
      await delay(connectionAttempts * 1000);
    }
  }
}

/** Subscribe to events broadcast by the leader tab. */
function setupChannel(): void {
  channel = new BroadcastChannel(SSE_BROADCAST_CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent) => {
    const message = event.data;
    if (message && message.kind === SSE_BROADCAST_KIND) {
      dispatch(message.eventType, message.data);
    }
  };
}

/**
 * Park on the leader lock. Exactly one tab holds it at a time; that tab owns
 * the SSE stream. The lock is held until the tab closes (browser auto-releases)
 * or the connection loop gives up, at which point another tab takes over.
 */
function requestLeadership(): void {
  navigator.locks
    .request(SSE_LEADER_LOCK_NAME, { mode: "exclusive" }, () => {
      isLeader = true;
      connectionShouldRun = true;
      connectionAttempts = 0;
      console.log("useSSE: Acquired leadership, opening shared SSE connection");
      // Hold the lock for as long as we own the connection by returning a
      // promise that only settles when the connection loop stops.
      return runConnectionLoop().finally(() => {
        isLeader = false;
        connectionShouldRun = false;
        console.log("useSSE: Releasing leadership");
      });
    })
    .catch((error) => {
      console.error("useSSE: Leader lock request failed", error);
    });
}

/** Fallback when cross-tab coordination APIs are unavailable: one stream per tab. */
function ensureStandalone(token: string | undefined): void {
  if (!initialized) {
    initialized = true;
    currentToken = token;
    connectionShouldRun = true;
    connectionAttempts = 0;
    runConnectionLoop();
    return;
  }
  if (currentToken !== token) {
    currentToken = token;
    connectionAttempts = 0;
    activeAbort?.abort(); // reconnect with the new token
  }
}

/**
 * Idempotently ensure the shared SSE connection is established. Safe to call
 * repeatedly (every consuming hook calls it from an effect); only the first
 * call per tab sets things up, and later calls only react to token changes.
 */
export function ensureSSEConnected(params: {
  token: string | undefined;
  apiUrl: string;
}): void {
  if (typeof window === "undefined") {
    return;
  }
  currentApiUrl = params.apiUrl;

  if (!supportsCoordination()) {
    ensureStandalone(params.token);
    return;
  }

  if (!initialized) {
    initialized = true;
    currentToken = params.token;
    setupChannel();
    requestLeadership();
    return;
  }

  // Token refreshed (e.g. in production). Only the leader holds a stream to
  // reconnect; followers just remember the new token in case they become
  // leader later.
  if (currentToken !== params.token) {
    currentToken = params.token;
    if (isLeader) {
      connectionAttempts = 0;
      activeAbort?.abort(); // triggers an immediate reconnect with the new token
    }
  }
}

export function bindSSEHandler(event: string, callback: SSEHandler): void {
  if (!handlers.has(event)) {
    handlers.set(event, new Set());
  }
  handlers.get(event)!.add(callback);
}

export function unbindSSEHandler(event: string, callback: SSEHandler): void {
  const eventHandlers = handlers.get(event);
  if (eventHandlers) {
    eventHandlers.delete(callback);
    if (eventHandlers.size === 0) {
      handlers.delete(event);
    }
  }
}

/** Test-only: reset module state between tests. */
export function __resetSSEManagerForTests(): void {
  handlers.clear();
  initialized = false;
  currentToken = undefined;
  currentApiUrl = undefined;
  connectionAttempts = 0;
  connectionShouldRun = false;
  activeAbort = null;
  isLeader = false;
  if (channel) {
    channel.onmessage = null;
    try {
      channel.close();
    } catch {
      // ignore
    }
  }
  channel = null;
}
