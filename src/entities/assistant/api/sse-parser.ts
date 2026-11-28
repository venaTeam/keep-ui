import {
  STREAM_EVENT_NAMES,
  StreamEvent,
  StreamEventName,
} from "../model/types";

const FRAME_END = /\r?\n\r?\n/;
const LINE_END = /\r?\n/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The fields the UI cannot do without, per event.
const IS_USABLE: Record<
  StreamEventName,
  (data: Record<string, unknown>) => boolean
> = {
  conversation: (data) =>
    typeof data.conversation_id === "string" &&
    typeof data.user_message_id === "string",
  text_delta: (data) =>
    typeof data.message_id === "string" && typeof data.delta === "string",
  tool_status: (data) =>
    typeof data.tool_call_id === "string" && typeof data.phase === "string",
  draft: (data) =>
    isRecord(data.draft) &&
    typeof data.draft.id === "string" &&
    typeof data.draft.state === "string",
  error: (data) => typeof data.code === "string",
  done: (data) => typeof data.finish_reason === "string",
  // Its path is shown only once navigation.ts reads it back
  link: (data) =>
    typeof data.id === "string" &&
    typeof data.page === "string" &&
    typeof data.path === "string" &&
    typeof data.label === "string",
};

const malformedFrame = (): StreamEvent => ({
  event: "error",
  data: {
    code: "internal",
    message: "Something went wrong. Try again.",
    retryable: true,
  },
});

function parseFrame(frame: string): StreamEvent | null {
  let name = "";
  const data: string[] = [];
  for (const line of frame.split(LINE_END)) {
    if (line.startsWith(":")) {
      continue;
    }
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") {
      name = value;
    } else if (field === "data") {
      data.push(value);
    }
  }
  // Heartbeats, and events of a newer server
  if (!(STREAM_EVENT_NAMES as readonly string[]).includes(name)) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(data.join("\n"));
    if (isRecord(parsed) && IS_USABLE[name as StreamEventName](parsed)) {
      return { event: name, data: parsed } as unknown as StreamEvent;
    }
  } catch {
    // Reported as a malformed frame
  }
  return malformedFrame();
}

/**
 * An incremental parser for the chat stream. `push` takes text split anywhere
 * and returns the events it completed. An unfinished frame is never reported.
 */
export function createStreamParser(): { push(chunk: string): StreamEvent[] } {
  let buffer = "";
  return {
    push(chunk) {
      buffer += chunk;
      const events: StreamEvent[] = [];
      let end: RegExpExecArray | null;
      while ((end = FRAME_END.exec(buffer)) !== null) {
        const event = parseFrame(buffer.slice(0, end.index));
        buffer = buffer.slice(end.index + end[0].length);
        if (event) {
          events.push(event);
        }
      }
      return events;
    },
  };
}
