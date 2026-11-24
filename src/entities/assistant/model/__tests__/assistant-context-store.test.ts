import { useAssistantContextStore } from "../assistant-context-store";

const store = useAssistantContextStore;
const a = { fingerprint: "a", name: "A", severity: "high", status: "firing" };
const b = { fingerprint: "b" };

beforeEach(() => {
  store.setState(store.getInitialState(), true);
  localStorage.clear();
});

it("holds the last selection", () => {
  store.getState().setSelection([a, b]);
  expect(store.getState().selection).toEqual([a, b]);
  store.getState().clearSelection();
  expect(store.getState().selection).toEqual([]);
});

it("notifies nobody when the selection is the same", () => {
  store.getState().setSelection([a, b]);
  const listener = jest.fn();
  const unsubscribe = store.subscribe(listener);
  store.getState().setSelection([{ ...a }, { ...b }]);
  expect(listener).not.toHaveBeenCalled();
  store.getState().setSelection([{ ...a, status: "resolved" }, b]);
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it("leaves a removed selection out until other alerts are ticked", () => {
  store.getState().setSelection([a]);
  store.getState().excludeSelection();
  expect(store.getState().selectionIncluded).toBe(false);

  // A refresh of the same alert
  store.getState().setSelection([{ ...a, status: "resolved" }]);
  expect(store.getState().selectionIncluded).toBe(false);

  store.getState().setSelection([a, b]);
  expect(store.getState().selectionIncluded).toBe(true);
});

it("takes a removed selection back after the message, or once it is cleared", () => {
  store.getState().setSelection([a]);
  store.getState().excludeSelection();
  store.getState().includeSelection();
  expect(store.getState().selectionIncluded).toBe(true);

  store.getState().excludeSelection();
  store.getState().clearSelection();
  expect(store.getState().selectionIncluded).toBe(true);
});

it("stores nothing in the browser", () => {
  store.getState().setSelection([a]);
  expect(localStorage).toHaveLength(0);
});
