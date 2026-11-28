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

  it("collects the links, between their tools' rows", () => {
    const items = run("link_created").items;
    expect(items.map((item) => item.type)).toEqual([
      "tool",
      "link",
      "tool",
      "link",
      "tool",
      "link",
      "text",
    ]);
    expect(items.filter((item) => item.type === "link")).toEqual(
      golden.streams.link_created.events
        .filter(({ event }) => event === "link")
        .map(({ data }) => ({ type: "link", link: data }))
    );
  });

  it("has one row per link", () => {
    const link = golden.streams.link_created.events.find(
      ({ event }) => event === "link"
    ) as StreamEvent;
    const turn = applyStreamEvent(
      applyStreamEvent(startTurn("open it"), link),
      link
    );
    expect(turn.items).toHaveLength(1);
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

  describe("with links", () => {
    const linkEvents = golden.streams.link_created.events.filter(
      ({ event }) => event === "link"
    ) as unknown as Extract<StreamEvent, { event: "link" }>[];
    // The links of the streamed turn, as the conversation stores them
    const storedLinks = linkEvents.map(
      ({ data }): TimelineItem => ({
        type: "link",
        ...data,
        created_at: "2026-11-24T10:00:00+00:00",
      })
    );

    it("stores a link with the fields it streamed", () => {
      const stored = golden.conversations.with_links.items.filter(
        (item) => item.type === "link"
      );
      expect(stored).toHaveLength(4);
      for (const item of stored) {
        expect(Object.keys(item).sort()).toEqual(
          [...Object.keys(linkEvents[0].data), "type", "created_at"].sort()
        );
      }
    });

    it("shows the stored links where they are", () => {
      const items = golden.conversations.with_links
        .items as unknown as TimelineItem[];
      expect(keys(mergeTimeline(items, null))).toEqual([
        id(2),
        `link-${id(40)}`,
        `link-${id(41)}`,
        id(5),
        id(6),
        `link-${id(42)}`,
        `link-${id(43)}`,
        id(7),
      ]);
      expect(mergeTimeline(items, null)[1]).toEqual({
        key: `link-${id(40)}`,
        type: "link",
        link: {
          id: id(40),
          page: "alerts_feed",
          param: null,
          path: "/alerts/feed",
          label: "Open the feed",
        },
      });
    });

    it("gives a live link the key and the entry of the stored one", () => {
      const turn = run("link_created");
      const live = mergeTimeline([], turn).filter(
        (entry) => entry.type === "link"
      );
      const stored = mergeTimeline(storedLinks, null);
      expect(live).toEqual(stored);
      expect(keys(stored)).toEqual([
        `link-${id(30)}`,
        `link-${id(31)}`,
        `link-${id(32)}`,
      ]);
      // Once stored, each link is shown once
      expect(keys(mergeTimeline(storedLinks, turn))).toEqual([
        ...keys(stored),
        id(2),
        "tool-call_1",
        "tool-call_2",
        "tool-call_3",
        id(4),
      ]);
    });

    it("leaves out a stored link without an id", () => {
      const [first] = storedLinks;
      const items = [{ ...first, id: undefined }] as unknown as TimelineItem[];
      expect(mergeTimeline(items, null)).toEqual([]);
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
