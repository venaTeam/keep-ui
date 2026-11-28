import { isNocAllowedPath } from "@/shared/lib/noc-routes";
import { LINK_PAGES, LinkPage } from "../model/types";

/*
 * The pages a link of the assistant may open: keep-api-gateway's
 * `src/services/assistant/navigation.py`, read the same way. The gateway builds
 * every link's path there; this build shows a link only when its path reads
 * back here as one of these pages. The fixture's `navigation` vectors pin both
 * sides to exactly the same paths.
 */

export const MAX_LINK_NAME_CHARS = 256;
export const MAX_LINK_CEL_CHARS = 2000;

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
// A value holding an escape looks encoded twice: no layer may decode it into
// something else
const ESCAPE = /%[0-9A-Fa-f]{2}/;
// "." or ".." between slashes or backslashes, which a URL parser walks up with
const DOT_SEGMENT = /(?:^|[/\\])\.\.?(?:[/\\]|$)/;
// What encodeURIComponent gives, and nothing else: one spelling per value
const ENCODED = /^(?:[A-Za-z0-9_.~!'()*-]|%[0-9A-F]{2})+$/;
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
// Python's str.isspace(), which the gateway's strip() uses: not U+FEFF
const ONLY_WHITESPACE =
  /^[\t-\r\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A parameter as the page reads it, or null when it can't be one. */
type ReadParam = (value: unknown) => string | null;

function readText(value: unknown, limit: number): string | null {
  if (
    typeof value !== "string" ||
    ONLY_WHITESPACE.test(value) ||
    // The gateway counts characters, not UTF-16 units
    Array.from(value).length > limit ||
    CONTROL.test(value) ||
    ESCAPE.test(value) ||
    LONE_SURROGATE.test(value)
  ) {
    return null;
  }
  return value;
}

/** A preset's or a dashboard's name, as it sits in a path segment. */
function readName(value: unknown): string | null {
  const name = readText(value, MAX_LINK_NAME_CHARS);
  return name === null || DOT_SEGMENT.test(name) ? null : name;
}

/** The feed finds a preset by its lowercased name; "feed" is its own page. */
function readPresetName(value: unknown): string | null {
  const name = readName(value)?.toLowerCase() ?? null;
  return name === "feed" ? null : name;
}

const readCel: ReadParam = (value) => readText(value, MAX_LINK_CEL_CHARS);

/** Canonical only: lowercase, with hyphens, nothing around it. */
const readUuid: ReadParam = (value) =>
  typeof value === "string" && UUID.test(value) ? value : null;

interface PageEntry {
  /** The path alone, or the part before the parameter. */
  path: string;
  /** Where the parameter goes: the last segment, or this query value. */
  query?: string;
  param?: ReadParam;
}

const PAGES: Record<LinkPage, PageEntry> = {
  alerts_feed: { path: "/alerts/feed" },
  alerts_preset: { path: "/alerts/", param: readPresetName },
  alerts_search: { path: "/alerts/feed", query: "cel", param: readCel },
  incidents: { path: "/incidents" },
  rules: { path: "/rules" },
  rule: { path: "/rules", query: "id", param: readUuid },
  dashboard: { path: "/dashboard/", param: readName },
};

export interface NavigationTarget {
  page: LinkPage;
  /** What the page shows; null for a page without a parameter. */
  param: string | null;
}

const isLinkPage = (page: string): page is LinkPage =>
  (LINK_PAGES as readonly string[]).includes(page);

function decode(raw: string): string | null {
  if (!ENCODED.test(raw)) {
    return null;
  }
  try {
    const value = decodeURIComponent(raw);
    return encodeURIComponent(value) === raw ? value : null;
  } catch {
    // Bytes that are not UTF-8
    return null;
  }
}

/**
 * The page a path opens and what it shows, for a path the gateway builds, and
 * null for every other one: another spelling, a scheme or host, a fragment,
 * another query key, a dot segment.
 */
export function parseNavigationPath(path: unknown): NavigationTarget | null {
  if (typeof path !== "string") {
    return null;
  }
  const mark = path.indexOf("?");
  const base = mark === -1 ? path : path.slice(0, mark);
  const query = mark === -1 ? "" : path.slice(mark + 1);
  for (const page of LINK_PAGES) {
    const entry = PAGES[page];
    if (!entry.param) {
      if (path === entry.path) {
        return { page, param: null };
      }
      continue;
    }
    let raw: string;
    if (entry.query === undefined) {
      if (mark !== -1 || !base.startsWith(entry.path)) {
        continue;
      }
      raw = base.slice(entry.path.length);
    } else {
      const key = `${entry.query}=`;
      if (mark === -1 || base !== entry.path || !query.startsWith(key)) {
        continue;
      }
      raw = query.slice(key.length);
    }
    const value = decode(raw);
    if (value !== null && entry.param(value) === value) {
      return { page, param: value };
    }
  }
  return null;
}

/**
 * The path of `page` showing `param`, as the gateway builds it, or null for a
 * page that can't be linked and a parameter the page does not take or would
 * not read back the same (a preset name is lowercased).
 */
export function buildNavigationPath(
  page: string,
  param: string | null = null
): string | null {
  if (!isLinkPage(page)) {
    return null;
  }
  const entry = PAGES[page];
  if (!entry.param) {
    return param === null ? entry.path : null;
  }
  const value = entry.param(param);
  if (value === null) {
    return null;
  }
  const encoded = encodeURIComponent(value);
  return entry.query === undefined
    ? entry.path + encoded
    : `${entry.path}?${entry.query}=${encoded}`;
}

/** Whether a NOC user may be sent to this page: the middleware's rule. */
export function isNocAllowedPage(page: string): boolean {
  return isLinkPage(page) && isNocAllowedPath(PAGES[page].path);
}
