import { act, fireEvent, render, screen } from "@testing-library/react";
import { AssistantToggle } from "@/components/navbar/AssistantToggle";
import { useAssistantPanelStore } from "@/entities/assistant";
import { useConfig } from "@/utils/hooks/useConfig";
import { AssistantPanelHost } from "../AssistantPanelHost";

const mockMounted = jest.fn();
const mockUnmounted = jest.fn();
jest.mock("../AssistantPanel", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    AssistantPanel: () => {
      useEffect(() => {
        mockMounted();
        return mockUnmounted;
      }, []);
      return <div>panel</div>;
    },
  };
});

const store = useAssistantPanelStore;
const toggleButton = () =>
  document.querySelector<HTMLElement>('[data-cy="nav-assistant-toggle"]');

const setConfig = (config: Record<string, unknown> | null) =>
  (useConfig as jest.Mock).mockReturnValue({ data: config });

const show = async () => {
  render(
    <>
      <input aria-label="input" />
      <textarea aria-label="textarea" />
      <AssistantToggle />
      <AssistantPanelHost />
    </>
  );
  await act(async () => {});
};

/** Whether the browser's own action, such as its downloads list, was kept. */
const press = async (
  element: Element = document.body,
  keys: KeyboardEventInit = { ctrlKey: true }
) => {
  let isDefaultKept = true;
  // Async, for the panel to be loaded
  await act(async () => {
    isDefaultKept = fireEvent.keyDown(element, {
      key: "j",
      code: "KeyJ",
      ...keys,
    });
    fireEvent.keyUp(element, { key: "j", code: "KeyJ" });
  });
  return isDefaultKept;
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  store.setState(store.getInitialState(), true);
  setConfig({ KEEP_ASSISTANT_ENABLED: true });
});

describe("with the flag off", () => {
  it.each([
    ["no config", null],
    ["no flag", {}],
    ["the flag off", { KEEP_ASSISTANT_ENABLED: false }],
    [
      "AI features disabled",
      { KEEP_ASSISTANT_ENABLED: true, KEEP_AI_FEATURES_DISABLED: true },
    ],
  ])("%s: no panel, no toggle and no shortcut", async (_, config) => {
    setConfig(config);
    // As it was left before the flag was turned off
    store.setState({ isOpen: true });
    await show();
    expect(screen.queryByText("panel")).toBeNull();
    expect(toggleButton()).toBeNull();
    expect(await press()).toBe(true);
    expect(store.getState().isOpen).toBe(true);
    expect(mockMounted).not.toHaveBeenCalled();
  });
});

describe("the shortcut", () => {
  it.each([
    ["Ctrl+J", { ctrlKey: true }],
    ["Cmd+J", { metaKey: true }],
  ])("%s toggles the panel, once for each press", async (_, keys) => {
    await show();
    expect(await press(document.body, keys)).toBe(false);
    expect(store.getState().isOpen).toBe(true);
    await press(document.body, keys);
    expect(store.getState().isOpen).toBe(false);
  });

  it.each(["input", "textarea"])("works in an %s", async (label) => {
    await show();
    await press(screen.getByLabelText(label));
    expect(store.getState().isOpen).toBe(true);
  });

  it.each([
    ["J alone", {}],
    ["Ctrl+Shift+J", { ctrlKey: true, shiftKey: true }],
  ])("is not %s", async (_, keys) => {
    await show();
    expect(await press(document.body, keys)).toBe(true);
    expect(store.getState().isOpen).toBe(false);
  });
});

describe("the toggle", () => {
  it("opens and closes the panel", async () => {
    await show();
    expect(toggleButton()).toHaveAttribute("aria-pressed", "false");
    await act(async () => toggleButton()?.click());
    expect(toggleButton()).toHaveAttribute("aria-pressed", "true");
    await act(async () => toggleButton()?.click());
    expect(toggleButton()).toHaveAttribute("aria-pressed", "false");
  });

  it.each([
    ["Win32", "AssistantCtrl+J"],
    ["MacIntel", "Assistant⌘J"],
  ])("has the shortcut of %s", async (platform, text) => {
    const original = navigator.platform;
    const set = (value: string) =>
      Object.defineProperty(navigator, "platform", {
        value,
        configurable: true,
      });
    set(platform);
    await show();
    expect(toggleButton()).toHaveTextContent(text);
    set(original);
  });
});

describe("the panel", () => {
  it("is loaded when it is first opened, and kept after that", async () => {
    await show();
    expect(mockMounted).not.toHaveBeenCalled();

    await press();
    expect(await screen.findByText("panel")).toBeInTheDocument();
    await press();
    await press();
    // Closing it must not abort an answer
    expect(mockMounted).toHaveBeenCalledTimes(1);
    expect(mockUnmounted).not.toHaveBeenCalled();
  });

  it("is loaded at once when it was open before a reload", async () => {
    store.setState({ isOpen: true });
    await show();
    expect(await screen.findByText("panel")).toBeInTheDocument();
  });
});
