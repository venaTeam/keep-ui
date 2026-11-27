import { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  DraftView,
  TimelineEntry,
  TOOL_OUTCOMES,
  ToolStatus,
} from "@/entities/assistant";
import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";
import { DRAFT_TOOL_NAMES } from "@/features/assistant-draft-card";
import { MessageBubble } from "../MessageBubble";
import { MessageList } from "../MessageList";

const mockMarkdown = jest.fn(({ content }: { content: string }) => (
  <div>{content}</div>
));
jest.mock("../AssistantMarkdown.dynamic", () => ({
  AssistantMarkdown: (props: { content: string }) => mockMarkdown(props),
}));

const onChange = jest.fn();
const onUncertain = jest.fn();
const onCheckAgain = jest.fn();

const message = (
  key: string,
  role: "user" | "assistant",
  content: string
): TimelineEntry => ({
  key,
  type: "message",
  role,
  content,
  status: "complete",
});
const tool = (overrides: Partial<ToolStatus> = {}): TimelineEntry => ({
  key: "tool-call_1",
  type: "tool",
  tool: {
    tool_call_id: "call_1",
    tool: "change_alert_status",
    phase: "started",
    label: "Preparing a status change",
    ...overrides,
  },
});
const draft = (name: keyof typeof golden.drafts): TimelineEntry => ({
  key: "draft-1",
  type: "draft",
  draft: golden.drafts[name] as unknown as DraftView,
});

type Props = ComponentProps<typeof MessageList>;

const show = (initial: Partial<Props> = {}) => {
  const element = (props: Partial<Props>) => (
    <MessageList
      entries={[]}
      hasMore={false}
      isLoading={false}
      isStreaming={false}
      isAnswering={false}
      timedOutDraftIds={new Set()}
      onChange={onChange}
      onUncertain={onUncertain}
      onCheckAgain={onCheckAgain}
      {...initial}
      {...props}
    />
  );
  const { rerender } = render(element({}));
  return { update: (props: Partial<Props>) => rerender(element(props)) };
};

const cy = (name: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(`[data-cy="${name}"]`));
const log = () => screen.getByRole("log");

beforeEach(() => jest.clearAllMocks());

describe("messages", () => {
  it("have their role", () => {
    show({
      entries: [message("1", "user", "ack"), message("2", "assistant", "ok")],
    });
    expect(
      cy("assistant-message").map(({ dataset, textContent }) => [
        dataset.role,
        textContent,
      ])
    ).toEqual([
      ["user", "ack"],
      ["assistant", "ok"],
    ]);
  });

  it("of the user are plain text", () => {
    show({ entries: [message("1", "user", "**not bold** <b>x</b>")] });
    expect(cy("assistant-message")[0].textContent).toBe(
      "**not bold** <b>x</b>"
    );
    expect(mockMarkdown).not.toHaveBeenCalled();
  });

  it.each([
    ["interrupted", "This answer was interrupted."],
    ["error", "This answer is not complete."],
  ] as const)("say that they are %s", (status, text) => {
    render(<MessageBubble role="assistant" content="half" status={status} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("that are finished are not rendered again while another one arrives", () => {
    const first = [message("1", "user", "ack"), message("2", "assistant", "a")];
    const { update } = show({ entries: first, isStreaming: true });
    mockMarkdown.mockClear();

    ["b", "bb", "bbb"].forEach((content) =>
      update({
        // New objects, as from a refetch
        entries: [
          ...first.map((entry) => ({ ...entry })),
          message("3", "assistant", content),
        ],
      })
    );
    expect(mockMarkdown.mock.calls.map(([{ content }]) => content)).toEqual([
      "b",
      "bb",
      "bbb",
    ]);
  });
});

describe("a tool", () => {
  it("shows a skeleton of the draft it prepares", () => {
    show({ entries: [tool()], isStreaming: true });
    expect(cy("assistant-tool-status")[0]).toHaveTextContent(
      "Preparing a status change"
    );
    expect(cy("assistant-draft-card")[0]).toHaveAttribute(
      "data-state",
      "streaming"
    );
  });

  it.each<[string, Partial<ToolStatus>, boolean]>([
    ["finished", { phase: "finished", outcome: "no_matches" }, true],
    ["drafts nothing", { tool: "search_docs" }, true],
    ["was cut off", {}, false],
  ])("shows no skeleton when it %s", (_, status, isStreaming) => {
    show({ entries: [tool(status)], isStreaming });
    expect(cy("assistant-tool-status")).toHaveLength(1);
    expect(cy("assistant-draft-card")).toHaveLength(0);
  });

  it("stops spinning when the stream is over", () => {
    const { update } = show({ entries: [tool()], isStreaming: true });
    const spins = () => !!document.querySelector(".animate-spin");
    expect(spins()).toBe(true);
    update({ isStreaming: false });
    expect(spins()).toBe(false);
  });

  it.each(TOOL_OUTCOMES)("has a text for %s", (outcome) => {
    show({ entries: [tool({ phase: "finished", outcome })] });
    const line = cy("assistant-tool-status")[0];
    expect(line).toHaveAttribute("data-outcome", outcome);
    expect(line.textContent).toMatch(/^Preparing a status change: \w+/);
  });

  it.each(DRAFT_TOOL_NAMES)("%s shows a skeleton of its draft", (name) => {
    show({ entries: [tool({ tool: name })], isStreaming: true });
    expect(cy("assistant-draft-card")).toHaveLength(1);
  });

  it.each([
    ["the tool limit", "tool_limit", "too many steps for one answer"],
    ["an outcome of a newer gateway", "summarized", "done"],
    ["an outcome named like a property", "constructor", "done"],
  ])("has a text for %s", (_, outcome, text) => {
    show({ entries: [tool({ phase: "finished", outcome })] });
    expect(cy("assistant-tool-status")[0]).toHaveTextContent(
      `Preparing a status change: ${text}`
    );
  });

  it.each([
    ["draft_created", true],
    ["found", true],
    ["link_ready", true],
    ["not_found", false],
    ["summarized", false],
  ])("is marked as done when it ended %s: %s", (outcome, isDone) => {
    show({ entries: [tool({ phase: "finished", outcome })] });
    const icon = cy("assistant-tool-status")[0].querySelector("svg");
    // CheckIcon's path, which the other icon does not have
    const isCheck = !!icon?.innerHTML.includes("m4.5 12.75 6 6 9-13.5");
    expect(isCheck).toBe(isDone);
  });
});

describe("a draft", () => {
  it("is a card", () => {
    show({ entries: [draft("applied")] });
    expect(cy("assistant-draft-card")[0]).toHaveAttribute(
      "data-state",
      "saved"
    );
  });

  it("offers to check again when its time is over", () => {
    show({
      entries: [draft("applying")],
      timedOutDraftIds: new Set([golden.drafts.applying.id]),
    });
    fireEvent.click(cy("assistant-draft-check-again")[0]);
    expect(onCheckAgain).toHaveBeenCalledWith(golden.drafts.applying.id);
  });
});

describe("what is going on", () => {
  const user = message("1", "user", "ack");

  it.each<[string, Partial<Props>, string]>([
    [
      "the conversation loads",
      { isLoading: true },
      "Loading the conversation…",
    ],
    ["there is none", {}, /Nothing changes until you confirm it/.source],
    ["the model thinks", { entries: [user], isStreaming: true }, "Thinking…"],
    [
      "the server answers",
      { entries: [user], isAnswering: true },
      "The assistant is still answering…",
    ],
    [
      "it has older messages",
      { entries: [user], hasMore: true },
      "Earlier messages are not shown.",
    ],
  ])("is said when %s", (_, props, text) => {
    show(props);
    expect(log()).toHaveTextContent(new RegExp(text));
  });

  it("is not said over the answer", () => {
    show({
      entries: [user, message("2", "assistant", "a")],
      isStreaming: true,
    });
    expect(log()).not.toHaveTextContent("Thinking");
  });

  it("is announced when the answer is complete", () => {
    const { update } = show({ entries: [user], isStreaming: true });
    expect(log()).toHaveAttribute("aria-busy", "true");
    update({ isStreaming: false });
    expect(log()).toHaveAttribute("aria-busy", "false");
  });
});

describe("scrolling", () => {
  const entry = (key: string) => message(key, "assistant", key);
  const setHeight = (scrollHeight: number) => {
    Object.defineProperty(log(), "scrollHeight", {
      value: scrollHeight,
      configurable: true,
    });
    Object.defineProperty(log(), "clientHeight", {
      value: 100,
      configurable: true,
    });
  };

  it("follows the end", () => {
    const { update } = show({ entries: [entry("1")] });
    setHeight(1_000);
    update({ entries: [entry("1"), entry("2")] });
    expect(log().scrollTop).toBe(1_000);
  });

  it("leaves the user where they scrolled to, until the next turn", () => {
    const { update } = show({ entries: [entry("1")] });
    setHeight(1_000);
    log().scrollTop = 200;
    fireEvent.scroll(log());
    update({ entries: [entry("1"), entry("2")] });
    expect(log().scrollTop).toBe(200);

    update({
      entries: [entry("1"), entry("2"), entry("3")],
      isStreaming: true,
    });
    expect(log().scrollTop).toBe(1_000);
  });
});
