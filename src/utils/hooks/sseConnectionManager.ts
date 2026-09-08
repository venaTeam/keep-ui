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
 * One tab is elected "leader" via an exclusive Web Lock and owns the only SSE
 * stream; it fans every event out to the other tabs over a `BroadcastChannel`.
 * When the leader tab closes, the browser releases its lock and a waiting tab
 * automatically takes over. The lock and the channel are scoped by the
 * session's active tenant, so a tab that switches tenant leaves the old scope
 * and competes for the new one instead of carrying a stream for the wrong
 * tenant.
 *
 * The stream is kept honest rather than trusted: a watchdog drops a stream
 * that has gone silent for longer than a few server keepalive intervals, a
 * failed connection is retried with capped exponential backoff for as long as
 * the tab is open (an `online` or visibility event cuts the wait short), and
 * every reconnect asks the open views to catch up on whatever was missed while
 * the stream was down.
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
  SSE_LEADER_STATE_KIND,
  SSE_RECONNECT_INITIAL_DELAY_MS,
  SSE_RECONNECT_JITTER_MS,
  SSE_RECONNECT_MAX_DELAY_MS,
  SSE_STALE_AFTER_MS,
  SSE_WATCHDOG_INTERVAL_MS,
} from "@/shared/constants";

type SSEHandler = (data: any) => void;
type TokenRefresher = () => Promise<string | undefined>;

const CATCH_UP_EVENTS = ["poll-alerts", "incident-change"];

const handlers: Map<string, Set<SSEHandler>> = new Map();

let initialized = false;
let currentToken: string | undefined;
let currentApiUrl: string | undefined;
let currentTenantId: string | undefined;
let currentRefreshToken: TokenRefresher | undefined;
let connectionShouldRun = false;
let loopGeneration = 0;
let activeAbort: AbortController | null = null;
let channel: BroadcastChannel | null = null;
let isLeader = false;
let hasConnectedBefore = false;
let reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS;
let staleAfterMs = SSE_STALE_AFTER_MS;
let lastByteAt = 0;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let wakeBackoff: (() => void) | null = null;
let leadershipAbort: AbortController | null = null;
let leaderVisible: boolean | undefined;
let lifecycleListenersInstalled = false;

function supportsCoordination(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof BroadcastChannel !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.locks &&
    typeof navigator.locks.request === "function"
  );
}

function isVisible(): boolean {
  return (
    typeof document !== "undefined" && document.visibilityState === "visible"
  );
}

/** Lock and channel names carry the active tenant so scopes never overlap. */
function scopedName(base: string): string {
  return `${base}:${currentTenantId ?? "default"}`;
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

/**
 * The leader tells the other tabs whether it is visible. Browsers throttle
 * timers in hidden tabs, so a hidden leader recovers slowly; a visible
 * follower uses this to take the stream over.
 */
function announceLeaderVisibility(): void {
  if (!channel) {
    return;
  }
  try {
    channel.postMessage({ kind: SSE_LEADER_STATE_KIND, visible: isVisible() });
  } catch (error) {
    console.error("useSSE: failed to announce leader visibility", error);
  }
}

/**
 * Parse a raw SSE block ("event: x\ndata: y") and emit it. The server's
 * `connected` event may announce its keepalive interval; the stale threshold
 * follows it so the two never drift apart.
 */
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
  if (
    eventType === "connected" &&
    typeof payload?.keepalive_seconds === "number"
  ) {
    staleAfterMs = Math.max(10_000, payload.keepalive_seconds * 3_000);
  }
  emit(eventType, payload);
}

/** Abort the connection once no byte (headers, event or keepalive) has arrived for too long. */
function startWatchdog(controller: AbortController): void {
  stopWatchdog();
  lastByteAt = Date.now();
  watchdogTimer = setInterval(() => {
    if (Date.now() - lastByteAt > staleAfterMs) {
      console.warn(`useSSE: No data for ${staleAfterMs}ms, reconnecting...`);
      controller.abort();
    }
  }, SSE_WATCHDOG_INTERVAL_MS);
}

function stopWatchdog(): void {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

/**
 * Wait out the current backoff and double it for next time. An `online` or
 * visibility event ends the wait early through `wakeBackoff`.
 */
function waitBeforeReconnect(): Promise<void> {
  const waitMs =
    reconnectDelayMs + Math.floor(Math.random() * SSE_RECONNECT_JITTER_MS);
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, SSE_RECONNECT_MAX_DELAY_MS);
  console.log(`useSSE: Reconnecting in ${waitMs}ms...`);
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      wakeBackoff = null;
      resolve();
    };
    const timer = setTimeout(finish, waitMs);
    wakeBackoff = finish;
  });
}

function installLifecycleListeners(): void {
  if (lifecycleListenersInstalled) {
    return;
  }
  lifecycleListenersInstalled = true;
  const resume = () => {
    reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS;
    wakeBackoff?.();
  };
  window.addEventListener("online", resume);
  document.addEventListener("visibilitychange", () => {
    if (!isVisible()) {
      if (isLeader) {
        announceLeaderVisibility();
      }
      return;
    }
    resume();
    if (isLeader) {
      announceLeaderVisibility();
    } else if (channel && leaderVisible !== true) {
      claimLeadership();
    }
  });
}

/**
 * Owns the single SSE stream. Used by the elected leader and by the standalone
 * fallback path. Reads `currentToken` fresh on every (re)connect so token
 * refreshes are picked up. Loops until `connectionShouldRun` is cleared or a
 * newer loop generation has taken over (tenant change).
 */
async function runConnectionLoop(generation: number): Promise<void> {
  if (!currentApiUrl) {
    console.error(
      "useSSE: API_URL not configured, cannot establish SSE connection"
    );
    return;
  }
  const sseUrl = `${currentApiUrl}/sse/subscribe`;

  while (connectionShouldRun && generation === loopGeneration) {
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

      startWatchdog(controller);
      const response = await fetch(sseUrl, {
        method: "POST",
        headers,
        signal: controller.signal,
      });
      lastByteAt = Date.now();

      if (!response.ok) {
        if (
          (response.status === 401 || response.status === 403) &&
          currentRefreshToken
        ) {
          const fresh = await currentRefreshToken();
          if (fresh && fresh !== token) {
            currentToken = fresh;
            stopWatchdog();
            continue;
          }
        }
        throw new Error(
          `SSE connection failed: ${response.status} ${response.statusText}`
        );
      }
      if (!response.body) {
        throw new Error("SSE connection failed: No body");
      }

      console.log("useSSE: Connected successfully");
      reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS;
      const isReconnect = hasConnectedBefore;
      hasConnectedBefore = true;
      emit("connected", { status: "connected" });
      if (isReconnect) {
        CATCH_UP_EVENTS.forEach((eventType) => emit(eventType, {}));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        lastByteAt = Date.now();
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";
        for (const block of blocks) {
          parseAndEmit(block);
        }
      }

      stopWatchdog();
      if (!connectionShouldRun || generation !== loopGeneration) {
        break;
      }
      console.log("useSSE: Stream ended by server, reconnecting...");
      await waitBeforeReconnect();
    } catch (error: any) {
      stopWatchdog();
      if (!connectionShouldRun || generation !== loopGeneration) {
        break;
      }
      if (controller.signal.aborted) {
        continue;
      }
      console.error("useSSE: Connection error", error);
      await waitBeforeReconnect();
    }
  }
}

/** Subscribe to events broadcast by the leader of this tenant scope. */
function setupChannel(): void {
  channel = new BroadcastChannel(scopedName(SSE_BROADCAST_CHANNEL_NAME));
  channel.onmessage = (event: MessageEvent) => {
    const message = event.data;
    if (!message) {
      return;
    }
    if (message.kind === SSE_BROADCAST_KIND) {
      dispatch(message.eventType, message.data);
    } else if (message.kind === SSE_LEADER_STATE_KIND) {
      leaderVisible = message.visible;
      if (!isLeader && message.visible === false && isVisible()) {
        claimLeadership();
      }
    }
  };
}

function closeChannel(): void {
  if (!channel) {
    return;
  }
  channel.onmessage = null;
  try {
    channel.close();
  } catch {}
  channel = null;
}

/**
 * Park on the leader lock of the current tenant scope. Exactly one tab holds
 * it at a time; that tab owns the SSE stream. The lock is held until the tab
 * closes (browser auto-releases), the scope is handed over, or a visible tab
 * steals it from a hidden leader, at which point another tab takes over. A
 * stolen leader stops its stream and queues up again as a follower.
 */
function requestLeadership(steal = false): void {
  const abort = new AbortController();
  leadershipAbort = abort;
  let generation = 0;
  const options = steal
    ? { mode: "exclusive" as const, steal: true }
    : { mode: "exclusive" as const, signal: abort.signal };
  navigator.locks
    .request(scopedName(SSE_LEADER_LOCK_NAME), options, () => {
      generation = ++loopGeneration;
      isLeader = true;
      connectionShouldRun = true;
      reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS;
      if (steal) {
        hasConnectedBefore = true;
      }
      announceLeaderVisibility();
      return runConnectionLoop(generation).finally(() => {
        if (generation === loopGeneration) {
          isLeader = false;
          connectionShouldRun = false;
        }
      });
    })
    .catch((error) => {
      if (error?.name !== "AbortError") {
        console.error("useSSE: Leader lock request failed", error);
        return;
      }
      if (generation !== 0 && generation === loopGeneration) {
        connectionShouldRun = false;
        isLeader = false;
        leaderVisible = undefined;
        activeAbort?.abort();
        requestLeadership();
      }
    });
}

/** A visible follower takes the stream over from a hidden leader. */
function claimLeadership(): void {
  leadershipAbort?.abort();
  requestLeadership(true);
}

/**
 * Hand the shared stream over to a new tenant scope: end the loop holding the
 * old scope's lock, drop the old channel, then compete for the new scope.
 */
function rescopeLeadership(): void {
  loopGeneration++;
  connectionShouldRun = false;
  isLeader = false;
  leadershipAbort?.abort();
  activeAbort?.abort();
  closeChannel();
  setupChannel();
  requestLeadership();
}

/** Fallback when cross-tab coordination APIs are unavailable: one stream per tab. */
function ensureStandalone(token: string | undefined): void {
  if (!initialized) {
    initialized = true;
    currentToken = token;
    connectionShouldRun = true;
    reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS;
    runConnectionLoop(++loopGeneration);
    return;
  }
  if (currentToken !== token) {
    currentToken = token;
    reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS;
    activeAbort?.abort();
  }
}

/**
 * Idempotently ensure the shared SSE connection is established. Safe to call
 * repeatedly (every consuming hook calls it from an effect); only the first
 * call per tab sets things up, and later calls only react to token and tenant
 * changes. `refreshToken` is asked for a fresh access token when the gateway
 * rejects a reconnect with 401/403, which a tab left in the background hits
 * once the identity provider's token lifetime has passed.
 */
export function ensureSSEConnected(params: {
  token: string | undefined;
  apiUrl: string;
  tenantId?: string;
  refreshToken?: TokenRefresher;
}): void {
  if (typeof window === "undefined") {
    return;
  }
  currentApiUrl = params.apiUrl;
  currentRefreshToken = params.refreshToken;
  installLifecycleListeners();

  if (!supportsCoordination()) {
    currentTenantId = params.tenantId;
    ensureStandalone(params.token);
    return;
  }

  if (!initialized) {
    initialized = true;
    currentToken = params.token;
    currentTenantId = params.tenantId;
    setupChannel();
    requestLeadership();
    return;
  }

  const tenantChanged = currentTenantId !== params.tenantId;
  const tokenChanged = currentToken !== params.token;
  currentToken = params.token;
  if (tenantChanged) {
    currentTenantId = params.tenantId;
    rescopeLeadership();
    return;
  }
  if (tokenChanged && isLeader) {
    reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS;
    activeAbort?.abort();
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
  currentTenantId = undefined;
  currentRefreshToken = undefined;
  leaderVisible = undefined;
  connectionShouldRun = false;
  loopGeneration++;
  activeAbort = null;
  isLeader = false;
  hasConnectedBefore = false;
  reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS;
  staleAfterMs = SSE_STALE_AFTER_MS;
  lastByteAt = 0;
  stopWatchdog();
  wakeBackoff = null;
  leadershipAbort?.abort();
  leadershipAbort = null;
  closeChannel();
}
