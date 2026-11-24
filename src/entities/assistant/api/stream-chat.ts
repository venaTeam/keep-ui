import { signOut as signOutClient } from "next-auth/react";
import type { ApiClient } from "@/shared/api";
import { recordAction, recordError } from "@/utils/metrics";
import { ChatRequest, StreamEvent } from "../model/types";
import { toChatError } from "./assistant-error";
import { createStreamParser } from "./sse-parser";

/** Longer than four of the server's 10 s heartbeats. */
export const STREAM_IDLE_TIMEOUT_MS = 45_000;

const CHAT_URL = "/assistant/chat";

/** The stream ended without `done`: only the server knows how the turn ended. */
export class StreamBrokenError extends Error {
  constructor(readonly reason: "timeout" | "truncated") {
    super(
      reason === "timeout"
        ? "The answer stopped arriving"
        : "The answer was cut off"
    );
    this.name = "StreamBrokenError";
  }
}

export interface StreamChatParams {
  api: Pick<ApiClient, "getToken">;
  request: ChatRequest;
  signal: AbortSignal;
  onEvent: (event: StreamEvent) => void;
}

function getHeaders(token: string | undefined): HeadersInit {
  return {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
    // A guest session's token is the literal "unauthenticated"
    ...(token &&
      token !== "unauthenticated" && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Streams one chat turn. Resolves after `done`. Rejects with a `KeepApiError`
 * when the server refused the message, with a `StreamBrokenError` or any other
 * error when the outcome is unknown, and with the signal's reason on abort.
 */
export async function streamChat({
  api,
  request,
  signal,
  onEvent,
}: StreamChatParams): Promise<void> {
  signal.throwIfAborted();

  const startedAt = performance.now();
  const controller = new AbortController();
  let rejectOnAbort: (reason: unknown) => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = reject;
  });
  // Nothing may be waiting for it when it rejects
  aborted.catch(() => {});

  let hasResponse = false;
  let hasTimedOut = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  const abort = (reason: unknown) => {
    controller.abort(reason);
    rejectOnAbort(reason);
  };
  const onCallerAbort = () => abort(signal.reason);
  const feedWatchdog = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      hasTimedOut = true;
      abort(new StreamBrokenError("timeout"));
    }, STREAM_IDLE_TIMEOUT_MS);
  };

  signal.addEventListener("abort", onCallerAbort);
  feedWatchdog();
  try {
    const response = await Promise.race([
      fetch(`/backend${CHAT_URL}`, {
        method: "POST",
        headers: getHeaders(api.getToken()),
        body: JSON.stringify(request),
        cache: "no-store",
        signal: controller.signal,
      }),
      aborted,
    ]);
    hasResponse = true;

    if (!response.ok) {
      recordError("assistant_message", response.status);
      if (response.status === 401) {
        await signOutClient();
      }
      throw await Promise.race([toChatError(response, CHAT_URL), aborted]);
    }

    const parser = createStreamParser();
    const decoder = new TextDecoder();
    reader = response.body?.getReader();
    while (reader) {
      const { done, value } = await Promise.race([
        reader.read().catch((error) => {
          if (signal.aborted || hasTimedOut) {
            throw error;
          }
          // The connection dropped: the same as an early end
          return { done: true as const, value: undefined };
        }),
        aborted,
      ]);
      if (done) {
        break;
      }
      feedWatchdog();
      for (const event of parser.push(
        decoder.decode(value, { stream: true })
      )) {
        onEvent(event);
        if (event.event === "done") {
          recordAction(
            "assistant_message",
            (performance.now() - startedAt) / 1000
          );
          return;
        }
      }
    }
    recordError("assistant_stream_truncated");
    throw new StreamBrokenError("truncated");
  } catch (error) {
    if (signal.aborted) {
      throw signal.reason;
    }
    if (hasTimedOut) {
      recordError("assistant_stream_timeout");
      throw new StreamBrokenError("timeout");
    }
    if (!hasResponse) {
      recordError("assistant_message");
    }
    throw error;
  } finally {
    clearTimeout(watchdog);
    signal.removeEventListener("abort", onCallerAbort);
    reader?.cancel().catch(() => {});
  }
}
