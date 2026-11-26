import {
  ChatContext,
  MAX_FINGERPRINT_CHARS,
  MAX_PAGE_CHARS,
  MAX_SELECTED_FINGERPRINTS,
} from "../model/types";

// The gateway refuses the whole message over one of these
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/;
const LONE_SURROGATES = /\p{Surrogate}/gu;

function isSendable(fingerprint: string): boolean {
  return (
    fingerprint.length >= 1 &&
    fingerprint.length <= MAX_FINGERPRINT_CHARS &&
    !CONTROL_CHARACTER.test(fingerprint) &&
    fingerprint.search(LONE_SURROGATES) === -1
  );
}

/** The context sent with a message. Ids only: the server re-reads the alerts. */
export function buildChatContext(
  page: string,
  selectedFingerprints: readonly string[]
): ChatContext {
  return {
    // The cut may leave half a character behind
    page: page.slice(0, MAX_PAGE_CHARS).replace(LONE_SURROGATES, ""),
    selected_fingerprints: selectedFingerprints
      .filter(isSendable)
      .slice(0, MAX_SELECTED_FINGERPRINTS),
    selected_count: selectedFingerprints.length,
  };
}
