import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import type { ActionLabel, PageLabel } from "@/metrics/labels";

const HEARTBEAT_INTERVAL_MS = 30_000;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

const HEARTBEAT_STORAGE_KEY = "keep_ui_user_id";

function getUserId(): string {
  if (typeof window === "undefined") return "server";
  let userId = localStorage.getItem(HEARTBEAT_STORAGE_KEY);
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem(HEARTBEAT_STORAGE_KEY, userId);
  }
  return userId;
}

async function sendHeartbeat() {
  const userId = getUserId();
  try {
    await axios.post("/api/metrics/heartbeat", { userId });
  } catch {
    // Fire-and-forget
  }
}

export function startHeartbeat() {
  if (heartbeatInterval !== null) return; // already running
  sendHeartbeat();
  heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat() {
  if (heartbeatInterval !== null) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Re-export the canonical (server-validated) label types.
export type { ActionLabel, PageLabel } from "@/metrics/labels";

// Record Page Load.
// No client-side dedup: every page load is counted (the old `recordedPages`
// Set undercounted within a session). Latency is intentionally not sent —
// callers had no real value to report (they always passed 0).
export async function recordPageLoad(label: PageLabel) {
  try {
    await axios.post("/api/metrics/page", { label });
  } catch (err) {
    // Silently fail
  }
}

// Record Action
export async function recordAction(label: ActionLabel, latencySeconds: number) {
  try {
    await axios.post("/api/metrics/action", { label, latency: latencySeconds });
  } catch (err) {
    // Silently fail
  }
}

// Helper for timing actions
export async function timeAction<T>(
  label: ActionLabel,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const latency = (performance.now() - start) / 1000;
    recordAction(label, latency);
  }
}

// Record Specific Error
export async function recordError(
  action: ActionLabel,
  statusCode?: string | number
) {
  try {
    await axios.post("/api/metrics/errors", {
      action,
      // Optional HTTP status code; the server buckets unknown codes to "other".
      ...(statusCode !== undefined ? { status_code: statusCode } : {}),
    });
  } catch {
    // Fire-and-forget
  }
}

let globalErrorTrackingStarted = false;

export function startGlobalErrorTracking() {
  if (globalErrorTrackingStarted || typeof window === "undefined") return;
  globalErrorTrackingStarted = true;

  // Capture all uncaught JavaScript errors
  window.addEventListener("error", () => {
    axios.post("/api/metrics/global-errors").catch(() => {});
  });

  // Capture all unhandled promise rejections
  window.addEventListener("unhandledrejection", () => {
    axios.post("/api/metrics/global-errors").catch(() => {});
  });
}
