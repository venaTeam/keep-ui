import { act, fireEvent, render, screen } from "@testing-library/react";
import { signOut } from "next-auth/react";
import {
  DraftView,
  MAX_MESSAGE_CHARS,
  useAssistantChat,
  useAssistantContextStore,
  useAssistantPanelStore,
} from "@/entities/assistant";
import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";
import { useConfig } from "@/utils/hooks/useConfig";
import { AssistantPanel } from "../AssistantPanel";

jest.mock("@/entities/assistant", () => ({
  ...jest.requireActual("@/entities/assistant"),
  useAssistantChat: jest.fn(),
}));
jest.mock("../AssistantMarkdown.dynamic", () => ({
  AssistantMarkdown: ({ content }: { content: string }) => <p>{content}</p>,
}));
const mockRevalidate = jest.fn();
jest.mock("@/shared/lib/state-utils", () => ({
  useRevalidateMultiple: () => mockRevalidate,
}));
jest.mock("next-auth/react", () => ({ signOut: jest.fn() }));

type Chat = ReturnType<typeof useAssistantChat>;

const idle: Chat = {
  entries: [],
  hasMore: false,
  isLoading: false,
  loadError: undefined,
  isStreaming: false,
  isAnswering: false,
  error: null,
  send: jest.fn(),
  startNew: jest.fn(),
  refetch: jest.fn(),
  replaceDraft: jest.fn(),
  timedOutDraftIds: new Set(),
  checkDraftAgain: jest.fn(),
};
const send = idle.send as jest.Mock;

const panelStore = useAssistantPanelStore;
const contextStore = useAssistantContextStore;

const cy = (name: string) =>
  document.querySelector<HTMLElement>(`[data-cy="${name}"]`);
const input = () => cy("assistant-composer-input") as HTMLTextAreaElement;
const sendButton = () => cy("assistant-composer-send") as HTMLButtonElement;

const element = (
  <>
    <button>opener</button>
    <AssistantPanel />
  </>
);
const show = (chat: Partial<Chat> = {}) => {
  const set = (next: Partial<Chat>) =>
    (useAssistantChat as jest.Mock).mockReturnValue({ ...idle, ...next });
  set(chat);
  const { rerender } = render(element);
  return {
    update: (next: Partial<Chat>) => {
      set(next);
      rerender(
        <>
          <button>opener</button>
          <AssistantPanel />
        </>
      );
    },
  };
};

const type = (value: string) =>
  fireEvent.change(input(), { target: { value } });
const enter = (init: object = {}) =>
  act(async () => {
    fireEvent.keyDown(input(), { key: "Enter", ...init });
  });
const select = (count: number) =>
  act(() =>
    contextStore.getState().setSelection(
      Array.from({ length: count }, (_, index) => ({
        fingerprint: `fp-${index}`,
        name: `secret name ${index}`,
      }))
    )
  );

beforeEach(() => {
  jest.resetAllMocks();
  send.mockResolvedValue(true);
  (useConfig as jest.Mock).mockReturnValue({ data: {} });
  localStorage.clear();
  panelStore.setState({ ...panelStore.getInitialState(), isOpen: true }, true);
  contextStore.setState(contextStore.getInitialState(), true);
});

describe("open and closed", () => {
  it("renders nothing while it is closed", () => {
    panelStore.setState({ isOpen: false });
    show();
    expect(cy("assistant-panel")).toBeNull();
  });

  it("is a section, docked on wide screens", () => {
    show();
    // The shell's grid looks for an aside, which is the navigation
    expect(cy("assistant-panel")?.tagName).toBe("SECTION");
    expect(cy("assistant-panel")).toHaveClass("xl:static", "xl:col-start-4");
    expect(screen.getByRole("region", { name: "Assistant" })).toBeVisible();
  });

  it("keeps the message being written when it is closed", () => {
    show();
    type("half a mess");
    fireEvent.click(cy("assistant-panel-close") as HTMLElement);
    expect(cy("assistant-panel")).toBeNull();
    act(() => panelStore.getState().toggle());
    expect(input()).toHaveValue("half a mess");
  });

  it("takes the focus when the user opens it, and gives it back", () => {
    panelStore.setState({ isOpen: false });
    show();
    const opener = screen.getByText("opener");
    opener.focus();
    act(() => panelStore.getState().toggle());
    expect(input()).toHaveFocus();

    fireEvent.click(cy("assistant-panel-close") as HTMLElement);
    expect(opener).toHaveFocus();
  });

  it("leaves the focus alone after a reload", () => {
    show();
    expect(input()).not.toHaveFocus();
  });

  it("leaves the focus where the user moved it", () => {
    panelStore.setState({ isOpen: false });
    show();
    act(() => panelStore.getState().toggle());
    const opener = screen.getByText("opener");
    opener.focus();
    act(() => panelStore.getState().close());
    expect(opener).toHaveFocus();
  });
});

describe("the composer", () => {
  it("sends on Enter, and is emptied", async () => {
    show();
    type("acknowledge these");
    await enter();
    expect(send).toHaveBeenCalledWith("acknowledge these", {
      page: "/alerts/feed",
      selected_fingerprints: [],
      selected_count: 0,
    });
    expect(input()).toHaveValue("");
  });

  it("sends with the button", async () => {
    show();
    expect(sendButton()).toBeDisabled();
    type("hello");
    expect(sendButton()).toBeEnabled();
    await act(async () => fireEvent.click(sendButton()));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Shift+Enter", { shiftKey: true }],
    ["the end of a composition", { isComposing: true }],
  ])("does not send on %s", async (_, init) => {
    show();
    type("hello");
    await enter(init);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not send nothing", async () => {
    show();
    type("  \n ");
    await enter();
    expect(send).not.toHaveBeenCalled();
    expect(sendButton()).toBeDisabled();
  });

  it.each([
    ["this page streams", { isStreaming: true }],
    ["the server gives", { isAnswering: true }],
  ])("waits for the answer %s", async (_, chat) => {
    show(chat);
    type("next");
    await enter();
    expect(send).not.toHaveBeenCalled();
    expect(sendButton()).toBeDisabled();
    expect(input()).toBeEnabled();
  });

  it("takes as much as the server does", () => {
    show();
    expect(input()).toHaveAttribute("maxlength", `${MAX_MESSAGE_CHARS}`);
  });

  it("gets a refused message back", async () => {
    let refuse: (isAccepted: boolean) => void = () => {};
    send.mockReturnValue(new Promise((resolve) => (refuse = resolve)));
    show();
    type("refused");
    await enter();
    expect(input()).toHaveValue("");
    type("written since");
    await act(async () => refuse(false));
    expect(input()).toHaveValue("refused\nwritten since");
  });
});

describe("the context", () => {
  it("has the page", () => {
    show();
    expect(cy("assistant-context-chip-page")).toHaveTextContent(
      "Page: /alerts/feed"
    );
    expect(cy("assistant-context-chip-selection")).toBeNull();
  });

  it.each([
    [1, "1 alert selected"],
    [3, "3 alerts selected"],
    [201, "201 alerts selected, the first 200 are sent"],
  ])("has a selection of %d", (count, text) => {
    show();
    select(count);
    expect(cy("assistant-context-chip-selection")?.textContent).toBe(text);
  });

  it("sends fingerprints only, and their true number", async () => {
    show();
    select(201);
    type("acknowledge");
    await enter();
    const [, context] = send.mock.calls[0];
    expect(context.selected_fingerprints).toHaveLength(200);
    expect(context.selected_count).toBe(201);
    expect(JSON.stringify(context)).not.toContain("secret name");
  });

  it("leaves a removed selection out of one message", async () => {
    show();
    select(2);
    fireEvent.click(cy("assistant-context-chip-remove") as HTMLElement);
    expect(cy("assistant-context-chip-selection")).toBeNull();
    type("first");
    await enter();
    expect(send.mock.calls[0][1]).toMatchObject({
      selected_fingerprints: [],
      selected_count: 0,
    });

    expect(cy("assistant-context-chip-selection")).not.toBeNull();
    type("second");
    await enter();
    expect(send.mock.calls[1][1].selected_count).toBe(2);
  });

  it("leaves it out of a refused message that is sent again", async () => {
    send.mockResolvedValueOnce(false);
    show();
    select(2);
    fireEvent.click(cy("assistant-context-chip-remove") as HTMLElement);
    type("first");
    await enter();
    expect(cy("assistant-context-chip-selection")).toBeNull();
    await enter();
    expect(send.mock.calls[1][1].selected_count).toBe(0);
  });
});

describe("errors", () => {
  const error = (code: string, retryAfterSeconds: number | null = null) => ({
    code,
    message: "What went wrong.",
    retryAfterSeconds,
  });

  it("are announced", () => {
    show({ error: error("llm_unavailable") });
    expect(screen.getByRole("alert")).toHaveTextContent("What went wrong.");
    expect(cy("assistant-error")).toHaveAttribute(
      "data-code",
      "llm_unavailable"
    );
    expect(cy("assistant-error-sign-in")).toBeNull();
    expect(cy("assistant-error-retry")).toBeNull();
  });

  it("say when to try again", () => {
    show({ error: error("rate_limited", 30) });
    expect(cy("assistant-error")).toHaveTextContent(
      "What went wrong. You can try again in 30 s."
    );
  });

  it("of an expired session offer to sign in again", () => {
    show({ error: error("unauthenticated") });
    fireEvent.click(cy("assistant-error-sign-in") as HTMLElement);
    expect(signOut).toHaveBeenCalledTimes(1);
    // Whose conversations these were is not left behind
    expect(localStorage.getItem("keep-assistant-panel")).toBeNull();
  });

  it("of loading the conversation offer to try again", () => {
    show({ loadError: new Error("502") });
    expect(cy("assistant-error")).toHaveTextContent(
      "The conversation could not be loaded."
    );
    fireEvent.click(cy("assistant-error-retry") as HTMLElement);
    expect(idle.refetch).toHaveBeenCalledWith();
  });

  it.each([
    ["while an answer arrives", { isStreaming: true }, null],
    ["under a newer one", { error: error("internal") }, "What went wrong."],
  ])("of loading are not shown %s", (_, chat, text) => {
    show({ loadError: new Error("502"), ...chat });
    expect(cy("assistant-error")?.textContent ?? null).toBe(text);
  });
});

it("starts a new conversation, ready to type", () => {
  show();
  fireEvent.click(cy("assistant-new-conversation") as HTMLElement);
  expect(idle.startNew).toHaveBeenCalledTimes(1);
  expect(input()).toHaveFocus();
});

it("refreshes the alerts when a draft is applied, even while it is closed", () => {
  const entries = (name: keyof typeof golden.drafts): Chat["entries"] => [
    {
      key: "draft-1",
      type: "draft",
      draft: {
        ...golden.drafts[name],
        id: "1",
      } as unknown as DraftView,
    },
  ];
  const { update } = show({ entries: entries("applying") });
  act(() => panelStore.getState().close());
  update({ entries: entries("applied") });
  expect(mockRevalidate).toHaveBeenCalledTimes(1);
});
