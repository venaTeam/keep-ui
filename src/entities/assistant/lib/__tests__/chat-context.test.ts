import { buildChatContext, getSearchCel } from "../chat-context";

const ZONE = "Europe/Paris";

const fingerprints = (count: number) =>
  Array.from({ length: count }, (_, index) => `fp-${index}`);

/** The query string of a page whose search box holds `cel`. */
const searchFor = (cel: string) => `?${new URLSearchParams({ cel })}`;

const resolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
const pretendTimeZone = (zone: string | undefined) => {
  jest
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...resolvedOptions.call(this), timeZone: zone as string };
    });
};

beforeEach(() => pretendTimeZone(ZONE));
afterEach(() => jest.restoreAllMocks());

it("carries the page, the selection and the time zone", () => {
  expect(buildChatContext("/alerts/feed", ["a", "b"])).toEqual({
    page: "/alerts/feed",
    selected_fingerprints: ["a", "b"],
    selected_count: 2,
    timezone: ZONE,
  });
});

it("is empty without a selection", () => {
  expect(buildChatContext("/incidents", [])).toEqual({
    page: "/incidents",
    selected_fingerprints: [],
    selected_count: 0,
    timezone: ZONE,
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
    timezone: ZONE,
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

// TODO: also run the gateway fixture's `chat_context` vectors once the fixture
// copy carries the `search_cel` ones.
describe("the search filter", () => {
  const CRITICAL = 'severity == "critical"';
  const searchCelOf = (cel: string, page = "/alerts/feed") =>
    buildChatContext(page, [], searchFor(cel)).search_cel;

  it("is the search box's filter on an alerts page", () => {
    expect(buildChatContext("/alerts/feed", [], searchFor(CRITICAL))).toEqual({
      page: "/alerts/feed",
      selected_fingerprints: [],
      selected_count: 0,
      search_cel: CRITICAL,
      timezone: ZONE,
    });
    expect(searchCelOf(CRITICAL, "/alerts/my-preset")).toBe(CRITICAL);
  });

  it("is read as the search box reads it", () => {
    expect(
      buildChatContext("/alerts/feed", [], "?page=2&cel=name+%3D%3D+%22db%22")
        .search_cel
    ).toBe('name == "db"');
  });

  it.each(["/incidents", "/maintenance", "/alerts", "/alertsfeed", "/"])(
    "is not sent from %s",
    (page) => {
      expect(
        buildChatContext(page, [], searchFor(CRITICAL))
      ).not.toHaveProperty("search_cel");
    }
  );

  it.each([
    ["without a query string", ""],
    ["without a filter", "?page=2"],
    ["with an empty filter", "?cel="],
    ["with a blank filter", searchFor("  ")],
  ])("is not sent %s", (_, search) => {
    expect(buildChatContext("/alerts/feed", [], search)).not.toHaveProperty(
      "search_cel"
    );
  });

  it("is sent whole up to 2000 characters", () => {
    const longest = `name == "${"x".repeat(1990)}"`;
    expect(longest).toHaveLength(2000);
    expect(searchCelOf(longest)).toBe(longest);
  });

  it("is dropped, never shortened, past 2000 characters", () => {
    const tooLong = `name == "${"x".repeat(1991)}"`;
    expect(tooLong).toHaveLength(2001);
    expect(searchCelOf(tooLong)).toBeUndefined();
  });

  it("counts characters as the gateway does, not UTF-16 units", () => {
    const withEmoji = `name == "${"x".repeat(1989)}\u{1f44d}"`;
    expect(withEmoji).toHaveLength(2001);
    expect(searchCelOf(withEmoji)).toBe(withEmoji);
    expect(searchCelOf(`${withEmoji} `)).toBeUndefined();
  });

  it.each([
    ["a line break", "\n"],
    ["a carriage return", "\r"],
    ["a tab", "\t"],
    ["NUL", "\u0000"],
    ["DEL", "\u007f"],
    ["a C1 control character", "\u0085"],
  ])("is dropped with %s, the gateway would refuse it", (_, character) => {
    expect(searchCelOf(`name == "a${character}b"`)).toBeUndefined();
  });

  it.each([
    ["right-to-left override U+202E", "‮"],
    ["left-to-right embedding U+202A", "‪"],
    ["left-to-right isolate U+2066", "⁦"],
    ["pop directional isolate U+2069", "⁩"],
    ["left-to-right mark U+200E", "‎"],
    ["right-to-left mark U+200F", "‏"],
    ["Arabic letter mark U+061C", "؜"],
    ["zero width space U+200B", "​"],
    ["zero width joiner U+200D", "‍"],
    ["byte order mark U+FEFF", "﻿"],
    ["soft hyphen U+00AD", "­"],
    ["line separator U+2028", " "],
    ["paragraph separator U+2029", " "],
  ])("is dropped with a %s", (_, character) => {
    expect(searchCelOf(`name == "a${character}b" && x == 1`)).toBeUndefined();
  });

  it("keeps any printable text", () => {
    const cel =
      'labels.team == "équipe" && name.contains("שרת") || x == "日本"';
    expect(searchCelOf(cel)).toBe(cel);
  });

  it("is the same in the chip, which reads the page's search params", () => {
    expect(
      getSearchCel("/alerts/feed", new URLSearchParams({ cel: CRITICAL }))
    ).toBe(CRITICAL);
    expect(getSearchCel("/alerts/feed", searchFor(CRITICAL))).toBe(CRITICAL);
    expect(
      getSearchCel("/alerts/feed", new URLSearchParams({ cel: "a‮b" }))
    ).toBeNull();
    expect(getSearchCel("/incidents", searchFor(CRITICAL))).toBeNull();
  });
});

describe("the time zone", () => {
  it.each(["Asia/Jerusalem", "UTC", "America/Argentina/Buenos_Aires"])(
    "is the browser's (%s)",
    (zone) => {
      pretendTimeZone(zone);
      expect(buildChatContext("/alerts/feed", []).timezone).toBe(zone);
    }
  );

  it("is sent as the browser gives it: the gateway decides whether it knows it", () => {
    pretendTimeZone("Mars/Olympus_Mons");
    expect(buildChatContext("/alerts/feed", []).timezone).toBe(
      "Mars/Olympus_Mons"
    );
  });

  it.each([
    ["has none", undefined],
    ["gives an empty one", ""],
  ])("is left out when the browser %s", (_, zone) => {
    pretendTimeZone(zone);
    expect(buildChatContext("/alerts/feed", [])).not.toHaveProperty("timezone");
  });

  it("is left out when Intl fails", () => {
    jest.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new RangeError("no time zone data");
    });
    expect(buildChatContext("/alerts/feed", [])).toEqual({
      page: "/alerts/feed",
      selected_fingerprints: [],
      selected_count: 0,
    });
  });
});
