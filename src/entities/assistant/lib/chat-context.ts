import {
  ChatContext,
  MAX_FINGERPRINT_CHARS,
  MAX_PAGE_CHARS,
  MAX_SEARCH_CEL_CHARS,
  MAX_SELECTED_FINGERPRINTS,
} from "../model/types";

// The gateway refuses the whole message over one of these
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/;
const LONE_SURROGATES = /\p{Surrogate}/gu;
// In a filter: controls, which the gateway refuses, and invisible characters
// (bidi controls, zero widths), which make it read differently from what it is
const UNSENDABLE_IN_FILTER = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
// The query parameter the alerts search box keeps its CEL in
const SEARCH_PARAM = "cel";

function isSendable(fingerprint: string): boolean {
  return (
    fingerprint.length >= 1 &&
    fingerprint.length <= MAX_FINGERPRINT_CHARS &&
    !CONTROL_CHARACTER.test(fingerprint) &&
    fingerprint.search(LONE_SURROGATES) === -1
  );
}

/** Whether the page has the alerts search box. */
export function isAlertsPage(page: string): boolean {
  return page.startsWith("/alerts/");
}

/**
 * The search box's filter as the model gets it, or null. Never shortened or
 * cleaned, which would make it another filter: one the gateway would refuse or
 * that does not read as it is is not sent at all.
 *
 * @param search the query string (`window.location.search`) or the page's
 *   search params.
 */
export function getSearchCel(
  page: string,
  search: string | URLSearchParams
): string | null {
  if (!isAlertsPage(page)) {
    return null;
  }
  const cel = new URLSearchParams(search).get(SEARCH_PARAM) ?? "";
  // The gateway counts characters, not UTF-16 units
  const length = Array.from(cel).length;
  if (
    cel.trim() === "" ||
    length > MAX_SEARCH_CEL_CHARS ||
    UNSENDABLE_IN_FILTER.test(cel)
  ) {
    return null;
  }
  return cel;
}

function getBrowserTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === "string" && zone !== "" ? zone : null;
  } catch {
    return null;
  }
}

/**
 * The context sent with a message. Ids only: the server re-reads the alerts.
 *
 * @param search the query string when the message is sent, read then rather
 *   than kept by the panel.
 */
export function buildChatContext(
  page: string,
  selectedFingerprints: readonly string[],
  search = ""
): ChatContext {
  const context: ChatContext = {
    // The cut may leave half a character behind
    page: page.slice(0, MAX_PAGE_CHARS).replace(LONE_SURROGATES, ""),
    selected_fingerprints: selectedFingerprints
      .filter(isSendable)
      .slice(0, MAX_SELECTED_FINGERPRINTS),
    selected_count: selectedFingerprints.length,
  };
  const searchCel = getSearchCel(page, search);
  if (searchCel !== null) {
    context.search_cel = searchCel;
  }
  const timezone = getBrowserTimeZone();
  if (timezone !== null) {
    context.timezone = timezone;
  }
  return context;
}
