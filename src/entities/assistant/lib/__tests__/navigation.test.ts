import golden from "../../__fixtures__/assistant_stream.json";
import { LINK_PAGES } from "../../model/types";
import {
  buildNavigationPath,
  isNocAllowedPage,
  MAX_LINK_CEL_CHARS,
  MAX_LINK_NAME_CHARS,
  parseNavigationPath,
} from "../navigation";

const { navigation } = golden;
const NOC = "noc";
const ID = "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f";

/** Rows named by a short, printable text. */
const named = <T>(rows: T[], name: (row: T) => string): [string, T][] =>
  rows.map((row) => [JSON.stringify(name(row)).slice(0, 80), row]);

describe("the fixture's navigation vectors", () => {
  it.each(named(navigation.vectors, (v) => `${v.role} ${v.path}`))(
    "%s",
    (_, vector) => {
      const target = parseNavigationPath(vector.path);
      if (target === null) {
        expect([vector.page, vector.param]).toEqual([null, null]);
        expect(vector.accepted).toBe(false);
        expect(vector.noc_allowed).toBeNull();
        return;
      }
      expect(target).toEqual({ page: vector.page, param: vector.param });
      expect(buildNavigationPath(target.page, target.param)).toBe(vector.path);
      expect(isNocAllowedPage(target.page)).toBe(vector.noc_allowed);
      expect(vector.accepted).toBe(
        vector.role !== NOC || isNocAllowedPage(target.page)
      );
    }
  );

  it.each(named(navigation.built, (v) => v.param))(
    "links a preset by its lowercased name: %s",
    (_, { page, param, path }) => {
      expect(buildNavigationPath(page, param)).toBe(path);
      expect(parseNavigationPath(path)).toEqual({
        page,
        param: param.toLowerCase(),
      });
    }
  );

  it.each(named(navigation.refused, (v) => `${v.page} ${v.param}`))(
    "builds no link from %s",
    (_, { page, param }) => {
      expect(buildNavigationPath(page, param)).toBeNull();
    }
  );

  it("have the module's pages and limits", () => {
    expect(navigation.pages).toEqual(LINK_PAGES);
    expect(golden.vocabulary.link_pages).toEqual(LINK_PAGES);
    expect(navigation.name_chars).toBe(MAX_LINK_NAME_CHARS);
    expect(navigation.cel_chars).toBe(MAX_LINK_CEL_CHARS);
  });

  it("cover every page, for NOC users too", () => {
    const { vectors } = navigation;
    const accepted = new Set(
      vectors.filter((v) => v.accepted).map((v) => v.page)
    );
    expect(accepted).toEqual(new Set(LINK_PAGES));
    const toNoc = new Set(
      vectors.filter((v) => v.role === NOC && v.accepted).map((v) => v.page)
    );
    expect(toNoc).toEqual(new Set(LINK_PAGES.filter(isNocAllowedPage)));
  });

  // C26: what encodeURIComponent leaves as it is, and what it escapes
  it("include the characters a name is encoded around", () => {
    const paths = navigation.vectors
      .filter((v) => v.accepted && v.param !== null)
      .map((v) => v.path)
      .join("");
    for (const kept of ["!", "'", "(", ")", "*", "~"]) {
      expect(paths).toContain(kept);
    }
    for (const escaped of ["%25", "%2F", "%20", "%C3%A9", "%F0%9F%94%A5"]) {
      expect(paths).toContain(escaped);
    }
  });
});

describe("every link the fixture streams or stores", () => {
  const links = [
    ...golden.streams.link_created.events.flatMap((event) =>
      event.event === "link" ? [event.data as Record<string, unknown>] : []
    ),
    ...golden.conversations.with_links.items.filter(
      (item) => item.type === "link"
    ),
  ] as unknown as { page: string; param: string | null; path: string }[];

  it("is read back as its page and parameter", () => {
    expect(links).toHaveLength(7);
    for (const { page, param, path } of links) {
      expect(parseNavigationPath(path)).toEqual({ page, param });
    }
  });
});

describe("parseNavigationPath", () => {
  it.each<[unknown]>([
    [null],
    [undefined],
    [7],
    [["/rules"]],
    [{ path: "/rules" }],
  ])("reads no page from %p", (path) => {
    expect(parseNavigationPath(path)).toBeNull();
  });

  it.each([
    ["an encoded lone surrogate", "/alerts/%ED%A0%80"],
    ["an overlong encoding", "/alerts/%C0%AF"],
    ["a name one character too long", `/dashboard/${"x".repeat(257)}`],
  ])("reads no page from %s", (_, path) => {
    expect(parseNavigationPath(path)).toBeNull();
  });

  it("reads the longest values", () => {
    expect(parseNavigationPath(`/dashboard/${"x".repeat(256)}`)).toEqual({
      page: "dashboard",
      param: "x".repeat(256),
    });
    expect(parseNavigationPath(`/alerts/feed?cel=${"x".repeat(2000)}`)).toEqual(
      { page: "alerts_search", param: "x".repeat(2000) }
    );
    expect(
      parseNavigationPath(`/alerts/feed?cel=${"x".repeat(2001)}`)
    ).toBeNull();
  });

  it("counts characters, not UTF-16 units", () => {
    const fire = "\u{1f525}".repeat(256);
    const path = `/dashboard/${encodeURIComponent(fire)}`;
    expect(parseNavigationPath(path)).toEqual({
      page: "dashboard",
      param: fire,
    });
    expect(parseNavigationPath(`${path}%F0%9F%94%A5`)).toBeNull();
  });
});

describe("buildNavigationPath", () => {
  it("knows only the pages of the table", () => {
    for (const page of ["workflows", "constructor", "__proto__", "toString"]) {
      expect(buildNavigationPath(page)).toBeNull();
    }
    expect(buildNavigationPath("alerts_feed")).toBe("/alerts/feed");
    expect(buildNavigationPath("alerts_feed", null)).toBe("/alerts/feed");
    expect(buildNavigationPath("rule", ID)).toBe(`/rules?id=${ID}`);
  });

  it.each([
    ["a lone surrogate", "a\ud800b"],
    ["a C1 control", "a\u0085b"],
    ["DEL", "a\u007fb"],
  ])("refuses %s", (_, param) => {
    for (const page of [
      "alerts_preset",
      "alerts_search",
      "dashboard",
      "rule",
    ]) {
      expect(buildNavigationPath(page, param)).toBeNull();
    }
  });

  // What the gateway's navigation.build gives for them
  it("lowercases a preset name as Python's lower() does", () => {
    expect(buildNavigationPath("alerts_preset", "ΟΔΟΣ")).toBe(
      "/alerts/%CE%BF%CE%B4%CE%BF%CF%82"
    );
    expect(buildNavigationPath("alerts_preset", "İstanbul")).toBe(
      "/alerts/i%CC%87stanbul"
    );
  });

  it("finds a value blank as Python's strip() does", () => {
    for (const blank of [" ", "\u00a0", "\u2003", "\u3000", "\u2028"]) {
      expect(buildNavigationPath("dashboard", blank)).toBeNull();
    }
    // Whitespace to String.prototype.trim, not to the gateway
    expect(buildNavigationPath("dashboard", "\ufeff")).toBe(
      "/dashboard/%EF%BB%BF"
    );
  });
});

describe("isNocAllowedPage", () => {
  it("allows the alerts pages only", () => {
    expect(LINK_PAGES.filter(isNocAllowedPage)).toEqual([
      "alerts_feed",
      "alerts_preset",
      "alerts_search",
    ]);
    for (const page of [
      "",
      "workflows",
      "incident",
      "ALERTS_FEED",
      "constructor",
    ]) {
      expect(isNocAllowedPage(page)).toBe(false);
    }
  });
});
