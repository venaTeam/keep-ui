import {
  MAX_FOLLOW_UP_FINGERPRINTS,
  useAssistantContextStore,
} from "../assistant-context-store";

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
  store
    .getState()
    .startFollowUp({ text: "Which are still firing?", fingerprints: ["a"] });
  expect(localStorage).toHaveLength(0);
});

describe("a follow-up", () => {
  it("makes its alerts the selection and holds its text for the composer", () => {
    store.getState().setSelection([a]);
    store.getState().excludeSelection();
    store.getState().startFollowUp({
      text: "Which are still firing?",
      fingerprints: ["b", "c"],
    });
    expect(store.getState()).toMatchObject({
      selection: [{ fingerprint: "b" }, { fingerprint: "c" }],
      selectionIncluded: true,
      composerPrefill: "Which are still firing?",
    });

    store.getState().clearComposerPrefill();
    expect(store.getState().composerPrefill).toBeNull();
    // The alerts stay for the message
    expect(store.getState().selection).toHaveLength(2);
  });

  it(`takes at most ${MAX_FOLLOW_UP_FINGERPRINTS} alerts`, () => {
    const fingerprints = Array.from(
      { length: 25 },
      (_, index) => `fp-${index}`
    );
    store.getState().startFollowUp({ text: "More?", fingerprints });
    expect(
      store.getState().selection.map(({ fingerprint }) => fingerprint)
    ).toEqual(fingerprints.slice(0, MAX_FOLLOW_UP_FINGERPRINTS));
  });
});
