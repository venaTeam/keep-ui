import { buildChatContext } from "../chat-context";

const fingerprints = (count: number) =>
  Array.from({ length: count }, (_, index) => `fp-${index}`);

it("carries the page and the selection", () => {
  expect(buildChatContext("/alerts/feed", ["a", "b"])).toEqual({
    page: "/alerts/feed",
    selected_fingerprints: ["a", "b"],
    selected_count: 2,
  });
});

it("is empty without a selection", () => {
  expect(buildChatContext("/incidents", [])).toEqual({
    page: "/incidents",
    selected_fingerprints: [],
    selected_count: 0,
  });
});

it("sends the first 200 fingerprints and the true count", () => {
  const context = buildChatContext("/alerts/feed", fingerprints(201));
  expect(context.selected_fingerprints).toEqual(fingerprints(200));
  expect(context.selected_count).toBe(201);
});

it.each([
  ["too long", "x".repeat(513)],
  ["empty", ""],
  ["with a control character", "a\u0007b"],
  ["with a C1 control character", "a\u0085b"],
  ["with half a character", "a\ud83d"],
])("drops a fingerprint the server refuses (%s)", (_, fingerprint) => {
  expect(buildChatContext("/alerts/feed", [fingerprint, "ok"])).toEqual({
    page: "/alerts/feed",
    selected_fingerprints: ["ok"],
    selected_count: 2,
  });
});

it("keeps a fingerprint of 512 characters and any printable text", () => {
  const unusual = ["x".repeat(512), "team/alert: é \u{1f44d}"];
  expect(buildChatContext("/", unusual).selected_fingerprints).toEqual(unusual);
});

it("cuts a long page without leaving half a character", () => {
  expect(buildChatContext(`/${"p".repeat(300)}`, []).page).toHaveLength(200);
  expect(buildChatContext(`${"p".repeat(199)}\u{1f44d}`, []).page).toBe(
    "p".repeat(199)
  );
});
