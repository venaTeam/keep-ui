import { DraftView } from "@/entities/assistant";

export type CardState =
  | "streaming"
  | "submitting"
  | "read-only"
  | "not-permitted"
  | "expired"
  | "draft"
  | "saved"
  | "partial"
  | "error"
  | "declined";

interface CardOptions {
  /** Keep is in read-only mode. */
  readOnly: boolean;
  /** Milliseconds since the epoch. */
  now: number;
  /** A Confirm is in flight on this page. */
  isSubmitting: boolean;
}

/** A date that cannot be parsed never expires here; the server decides. */
function isPast(date: string | null, now: number): boolean {
  return !!date && Date.parse(date) <= now;
}

/**
 * How the card shows a draft. Keyed on the draft's own state and never on the
 * status of the response that carried it, so a final state always wins over
 * what this page was doing. Null is a draft the stream has not sent yet.
 */
export function getDraftCardState(
  draft: DraftView | null,
  { readOnly, now, isSubmitting }: CardOptions
): CardState {
  if (!draft) {
    return "streaming";
  }
  switch (draft.state) {
    case "applying":
      return "submitting";
    case "applied":
      return "saved";
    case "partially_applied":
      return "partial";
    case "discarded":
      return "declined";
    case "expired":
      return "expired";
    case "failed":
      switch (draft.outcome?.code) {
        case "read_only":
          return "read-only";
        case "not_permitted":
          return "not-permitted";
        default:
          return "error";
      }
    case "pending":
      if (isSubmitting) {
        return "submitting";
      }
      if (readOnly) {
        return "read-only";
      }
      if (!draft.permitted) {
        return "not-permitted";
      }
      return isPast(draft.expires_at, now) ? "expired" : "draft";
  }
}
