import golden from "../../__fixtures__/assistant_stream.json";
import { DraftView, StreamEvent, TimelineItem } from "../../model/types";
import {
  applyStreamEvent,
  getLiveDrafts,
  hasStoredTurn,
  mergeTimeline,
  replaceLiveDraft,
  startTurn,
} from "../live-turn";

const run = (name: keyof typeof golden.streams) =>
  (golden.streams[name].events as StreamEvent[]).reduce(
    (turn, event) => applyStreamEvent(turn, event),
    startTurn("acknowledge these")
  );

const id = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

describe("applyStreamEvent", () => {
  it("collects a turn with two rounds, a tool call and a draft", () => {
    expect(run("draft_created")).toEqual({
      userMessage: "acknowledge these",
      userMessageId: id(2),
      items: [
        {
          type: "text",
          messageId: id(4),
          content: "Let me look at the selected alerts.",
        },
        {
          type: "tool",
          tool: {
            tool_call_id: "call_1",
            tool: "change_alert_status",
            phase: "finished",
            label: "Preparing a status change",
            outcome: "draft_created",
          },
        },
        { type: "draft", draft: golden.drafts.pending },
        {
          type: "text",
          messageId: id(5),
          content:
            'I drafted the change.\n\nConfirm it on the **card**: 3 alerts → "acknowledged" ✓ \u{1f44d}',
        },
      ],
      error: null,
      isInterrupted: false,
    });
  });

  it("has one row per tool call", () => {
    const tools = run("narrowing").items.flatMap((item) =>
      item.type === "tool" ? [[item.tool.tool_call_id, item.tool.outcome]] : []
    );
    expect(tools).toEqual([
      ["call_1", "invalid_cel"],
      ["call_2", "invalid_arguments"],
      ["call_3", "too_many_matches"],
      ["call_4", "no_matches"],
      ["call_5", "nothing_to_change"],
    ]);
  });

  it("keeps the error", () => {
    expect(run("error_llm_rate_limited").error).toEqual({
      code: "llm_rate_limited",
      message: "The assistant is busy. Try again shortly.",
      retryable: true,
    });
  });

  it("keeps what a truncated stream sent", () => {
    const turn = run("truncated");
    expect(turn.items).toHaveLength(4);
    expect(turn.error).toBeNull();
  });

  describe("of a newer gateway", () => {
    const events = golden.future.stream.events as StreamEvent[];
    const unknown = events.find(
      ({ event }) => event === golden.future.values.event
    ) as StreamEvent;

    it("ignores an event it does not know", () => {
      const turn = startTurn("quiet hours");
      expect(applyStreamEvent(turn, unknown)).toBe(turn);
    });

    it("keeps the kinds and codes it does not know", () => {
      const turn = events.reduce(applyStreamEvent, startTurn("quiet hours"));
      expect(turn.items).toEqual([
        {
          type: "tool",
          tool: expect.objectContaining({
            outcome: golden.future.values.tool_outcome,
          }),
        },
        { type: "draft", draft: golden.future.drafts.pending },
        { type: "text", messageId: id(4), content: "I drafted quiet hours." },
      ]);
      expect(turn.error).toBeNull();
    });
  });
});

describe("drafts of the live turn", () => {
  const applied = {
    ...golden.drafts.pending,
    state: "applied",
  } as unknown as DraftView;

  it("are listed and replaced", () => {
    const turn = run("draft_created");
    expect(getLiveDrafts(turn)).toEqual([golden.drafts.pending]);
    expect(getLiveDrafts(replaceLiveDraft(turn, applied))).toEqual([applied]);
    expect(getLiveDrafts(null)).toEqual([]);
  });

  it("do not include the drafts of other turns", () => {
    const turn = run("draft_created");
    expect(replaceLiveDraft(turn, { ...applied, id: "other" })).toBe(turn);
  });
});

describe("mergeTimeline", () => {
  const stored = golden.conversations.finished
    .items as unknown as TimelineItem[];
  const keys = (entries: { key: string }[]) => entries.map(({ key }) => key);

  it("shows the stored conversation", () => {
    expect(mergeTimeline(stored, null)).toEqual([
      {
        key: id(2),
        type: "message",
        role: "user",
        content: "acknowledge these with the note investigating",
        status: "complete",
      },
      {
        key: id(4),
        type: "message",
        role: "assistant",
        content: "Let me look at the selected alerts.",
        status: "complete",
      },
      { key: `draft-${id(14)}`, type: "draft", draft: golden.drafts.applied },
      {
        key: id(5),
        type: "message",
        role: "assistant",
        content: "I drafted the change.",
        status: "complete",
      },
    ]);
  });

  it("shows the live turn after it", () => {
    expect(keys(mergeTimeline([], run("draft_created")))).toEqual([
      id(2),
      id(4),
      "tool-call_1",
      `draft-${id(10)}`,
      id(5),
    ]);
  });

  it("shows the user's message before the server answers", () => {
    expect(mergeTimeline([], startTurn("hello"))).toEqual([
      {
        key: "live-user-message",
        type: "message",
        role: "user",
        content: "hello",
        status: "complete",
      },
    ]);
  });

  it("takes an item that is stored by now from the server", () => {
    const turn = run("draft_created");
    const merged = mergeTimeline(stored, turn);
    expect(keys(merged)).toEqual([
      id(2),
      id(4),
      `draft-${id(14)}`,
      id(5),
      "tool-call_1",
      `draft-${id(10)}`,
    ]);
    expect(merged[0]).toMatchObject({
      content: "acknowledge these with the note investigating",
    });
  });

  it("leaves out a stored item of a newer gateway", () => {
    const items = golden.future.conversation.items as unknown as TimelineItem[];
    expect(items).toHaveLength(3);
    expect(keys(mergeTimeline(items, null))).toEqual([
      id(2),
      `draft-${id(51)}`,
    ]);
  });

  it("marks the text a broken turn was writing", () => {
    const statuses = mergeTimeline([], {
      ...run("truncated"),
      isInterrupted: true,
    }).flatMap((entry) => (entry.type === "message" ? [entry.status] : []));
    expect(statuses).toEqual(["complete", "complete", "interrupted"]);
  });
});

describe("hasStoredTurn", () => {
  const stored = golden.conversations.finished
    .items as unknown as TimelineItem[];

  it("looks for the message that started the turn", () => {
    expect(hasStoredTurn(stored, run("draft_created"))).toBe(true);
    expect(hasStoredTurn([], run("draft_created"))).toBe(false);
    expect(hasStoredTurn(stored, startTurn("hello"))).toBe(false);
  });
});
