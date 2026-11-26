import { ASSISTANT_PANEL_STORAGE_KEY } from "@/shared/lib/assistant-storage";
import { useAssistantPanelStore } from "../assistant-panel-store";

const store = useAssistantPanelStore;
const stored = () =>
  JSON.parse(localStorage.getItem(ASSISTANT_PANEL_STORAGE_KEY) ?? "null");

const rehydrateFrom = async (value: string) => {
  localStorage.setItem(ASSISTANT_PANEL_STORAGE_KEY, value);
  await store.persist.rehydrate();
};

beforeEach(() => {
  store.setState(store.getInitialState(), true);
  localStorage.clear();
});

it("is closed until it is toggled", () => {
  expect(store.getState().isOpen).toBe(false);
  store.getState().toggle();
  expect(store.getState().isOpen).toBe(true);
  store.getState().toggle();
  expect(store.getState().isOpen).toBe(false);
  store.getState().toggle();
  store.getState().close();
  expect(store.getState().isOpen).toBe(false);
});

it("keeps one conversation per tenant", () => {
  store.getState().setConversationId("keep", "c-1");
  store.getState().setConversationId("other", "c-2");
  store.getState().setConversationId("keep", "c-3");
  expect(store.getState().conversationIdByTenant).toEqual({
    keep: "c-3",
    other: "c-2",
  });
});

it("stores only whether it is open and the ids by tenant", () => {
  store.getState().toggle();
  store.getState().setConversationId("keep", "c-1");
  expect(stored()).toEqual({
    state: { isOpen: true, conversationIdByTenant: { keep: "c-1" } },
    version: 1,
  });
});

it("forgets one tenant's conversation", () => {
  store.getState().setConversationId("keep", "c-1");
  store.getState().setConversationId("other", "c-2");
  store.getState().clearConversationId("keep");
  expect(store.getState().conversationIdByTenant).toEqual({ other: "c-2" });
  expect(stored().state.conversationIdByTenant).toEqual({ other: "c-2" });
});

it("does not forget a conversation that replaced the missing one", () => {
  store.getState().setConversationId("keep", "c-2");
  store.getState().clearConversationId("keep", "c-1");
  expect(store.getState().conversationIdByTenant).toEqual({ keep: "c-2" });
  store.getState().clearConversationId("keep", "c-2");
  expect(store.getState().conversationIdByTenant).toEqual({});
});

it("is restored from storage", async () => {
  await rehydrateFrom(
    '{"state": {"isOpen": true, "conversationIdByTenant": {"keep": "c-1"}}, "version": 1}'
  );
  expect(store.getState()).toMatchObject({
    isOpen: true,
    conversationIdByTenant: { keep: "c-1" },
    // So that a reload does not move the focus
    isOpenedByUser: false,
  });
  store.getState().toggle();
  expect(store.getState().isOpenedByUser).toBe(true);
});

it.each([
  ['{"state": null, "version": 1}'],
  [
    '{"state": {"isOpen": "yes", "conversationIdByTenant": null}, "version": 1}',
  ],
  [
    '{"state": {"conversationIdByTenant": {"keep": 1, "a": {}, "b": ""}}, "version": 1}',
  ],
])("ignores the unusable stored value %s", async (value) => {
  await rehydrateFrom(value);
  expect(store.getState()).toMatchObject({
    isOpen: false,
    conversationIdByTenant: {},
  });
});
