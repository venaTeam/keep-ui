/**
 * @jest-environment node
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import golden from "../../__fixtures__/assistant_stream.json";
import {
  ALERT_RESULTS,
  DISCARD_REASONS,
  DRAFT_STATES,
  FINISH_REASONS,
  GATEWAY_RESULTS,
  MESSAGE_STATUSES,
  OBJECT_TYPES,
  OUTCOME_CODES,
  STREAM_ERROR_CODES,
  STREAM_EVENT_NAMES,
  TARGET_STATUSES,
  TIMELINE_ITEM_TYPES,
  TOOL_OUTCOMES,
  TOOL_PHASES,
} from "../../model/types";
import { createStreamParser } from "../sse-parser";

const streams = golden.streams as Record<
  string,
  { raw: string; events: unknown[] }
>;
const streamNames = Object.keys(streams);

const parseInChunks = (raw: string, size: number) => {
  const parser = createStreamParser();
  const events: unknown[] = [];
  for (let start = 0; start < raw.length; start += size) {
    events.push(...parser.push(raw.slice(start, start + size)));
  }
  return events;
};

const malformed = {
  event: "error",
  data: {
    code: "internal",
    message: "Something went wrong. Try again.",
    retryable: true,
  },
};

describe("the vendored contract", () => {
  it("is the gateway's golden fixture, byte for byte", () => {
    const bytes = readFileSync(
      path.join(__dirname, "../../__fixtures__/assistant_stream.json")
    );
    // The git blob id of the fixture in keep-api-gateway
    const blobId = createHash("sha1")
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest("hex");
    expect(blobId).toBe("bfaf94e1ed517d0f4d0911c7d5f93c82b800918c");
  });

  it("has the same vocabulary as the types", () => {
    expect(golden.vocabulary).toEqual({
      events: STREAM_EVENT_NAMES,
      tool_phases: TOOL_PHASES,
      tool_outcomes: TOOL_OUTCOMES,
      stream_error_codes: STREAM_ERROR_CODES,
      finish_reasons: FINISH_REASONS,
      draft_states: DRAFT_STATES,
      target_statuses: TARGET_STATUSES,
      outcome_codes: OUTCOME_CODES,
      gateway_results: GATEWAY_RESULTS,
      alert_results: ALERT_RESULTS,
      object_types: OBJECT_TYPES,
      message_statuses: MESSAGE_STATUSES,
      discard_reasons: DISCARD_REASONS,
    });
  });

  it("has values of a newer gateway that this build does not know", () => {
    const { values } = golden.future;
    const known: [string, readonly string[]][] = [
      [values.event, STREAM_EVENT_NAMES],
      [values.item_type, TIMELINE_ITEM_TYPES],
      [values.outcome_code, OUTCOME_CODES],
      [values.object_type, OBJECT_TYPES],
      [values.tool_outcome, TOOL_OUTCOMES],
      [values.gateway_result, GATEWAY_RESULTS],
      [values.alert_result, ALERT_RESULTS],
    ];
    known.forEach(([value, list]) => expect(list).not.toContain(value));
  });
});

describe("a stream of a newer gateway", () => {
  const { raw, events } = golden.future.stream;
  const known = events.filter(
    ({ event }) => event !== golden.future.values.event
  );

  it("is parsed without the events this build does not know", () => {
    expect(known).toHaveLength(events.length - 1);
    expect(createStreamParser().push(raw)).toEqual(known);
  });

  it("is parsed the same when split anywhere", () => {
    for (const size of [1, 2, 3, 7, 64]) {
      expect(parseInChunks(raw, size)).toEqual(known);
    }
  });
});

describe("createStreamParser", () => {
  it.each(streamNames)("parses the golden stream %s in one piece", (name) => {
    const { raw, events } = streams[name];
    expect(createStreamParser().push(raw)).toEqual(events);
  });

  it.each(streamNames)("parses the golden stream %s split anywhere", (name) => {
    const { raw, events } = streams[name];
    for (const size of [1, 2, 3, 7, 64]) {
      expect(parseInChunks(raw, size)).toEqual(events);
    }
  });

  it("reports nothing for an unfinished frame", () => {
    expect(
      createStreamParser().push('event: done\ndata: {"finish_reason": "stop"}')
    ).toEqual([]);
  });

  it("ignores heartbeats, also one split over two chunks", () => {
    const parser = createStreamParser();
    expect(parser.push(golden.heartbeat)).toEqual([]);
    expect(parser.push(": h")).toEqual([]);
    expect(parser.push("b\n\n")).toEqual([]);
  });

  it("accepts CRLF line ends, also split between CR and LF", () => {
    const parser = createStreamParser();
    const raw = golden.streams.cancelled.raw.replace(/\n/g, "\r\n");
    const events = Array.from(raw).flatMap((char) => parser.push(char));
    expect(events).toEqual(golden.streams.cancelled.events);
  });

  it("skips events it does not know", () => {
    expect(
      createStreamParser().push('event: usage\ndata: {"tokens": 1}\n\n')
    ).toEqual([]);
  });

  it.each([
    ["invalid JSON", "event: text_delta\ndata: {nope\n\n"],
    ["no data", "event: text_delta\n\n"],
    ["data that is not an object", "event: text_delta\ndata: []\n\n"],
    ["a missing field", 'event: text_delta\ndata: {"delta": "a"}\n\n'],
    ["a draft without an id", 'event: draft\ndata: {"draft": {}}\n\n'],
  ])("turns a frame with %s into an error event", (_, raw) => {
    expect(createStreamParser().push(raw)).toEqual([malformed]);
  });

  it("goes on after a malformed frame", () => {
    const events = createStreamParser().push(
      'event: error\ndata: nope\n\nevent: done\ndata: {"message_id": null, "finish_reason": "error"}\n\n'
    );
    expect(events).toEqual([
      malformed,
      { event: "done", data: { message_id: null, finish_reason: "error" } },
    ]);
  });
});
