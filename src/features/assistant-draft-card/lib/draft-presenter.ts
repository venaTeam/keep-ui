import { ComponentType, createElement, ReactElement } from "react";
import {
  AlertResult,
  ConfirmDraftBody,
  DraftView,
  FollowUp,
  MAX_FOLLOW_UP_FINGERPRINTS,
} from "@/entities/assistant";
import { CardState } from "./draft-card-state";

// The presenter interface: one presenter per draft kind, registered in
// `ui/draft-body-registry.tsx`. A new kind adds a presenter, not branches in
// the card.

/** An SWR key to revalidate once a draft becomes final. */
export interface RefreshKey {
  key: string;
  /** False matches every key that starts with `key`. */
  isExact: boolean;
}

/** What Confirm sends with the draft, or why it can't be confirmed here. */
export type ConfirmInput =
  | { isBlocked: false; body: ConfirmDraftBody | null }
  | { isBlocked: true; reason: string };

/** Confirm sends no body: the kinds that need nothing from the browser. */
export const NO_CONFIRM_INPUT: ConfirmInput = { isBlocked: false, body: null };

/** Where the draft can be finished by hand, and what the form starts with. */
export interface OpenInForm {
  targetPath: string;
  data: unknown;
}

/** How the outcome lists the alerts by their result, in this order. */
export type ResultLabels = readonly (readonly [AlertResult, string])[];

export const ALERT_RESULT_LABELS: ResultLabels = [
  ["applied", "Changed"],
  ["failed", "Not changed"],
  ["unconfirmed", "Not confirmed"],
  ["skipped", "Skipped"],
  ["not_found", "Not found"],
];

export interface DraftBodyProps<P> {
  payload: P;
  draft: DraftView;
}

export interface DraftPresenter<P> {
  kind: string;
  /** The tool that makes this kind: a card skeleton shows while it runs. */
  tool: string;
  /**
   * The payload, or null when this build can't show all of it (another
   * version, a shape it does not know): the card then shows it as it is,
   * without a Confirm.
   */
  parse: (draft: DraftView) => P | null;
  /** The whole change, as Confirm would make it. */
  Body: ComponentType<DraftBodyProps<P>>;
  /** The exact change, as the label of the button that makes it. */
  confirmLabel: (payload: P) => string;
  notPermittedText: string;
  /** Leave out for no body. Blocked disables Confirm and says why. */
  confirmInput?: (payload: P) => ConfirmInput;
  /** Leave out for a kind without a form. */
  openInForm?: (payload: P, draft: DraftView) => OpenInForm | null;
  /** Keyed on the draft's state and outcome: [] when nothing changed. */
  refreshKeys: (draft: DraftView, payload: P) => RefreshKey[];
  resultLabels: ResultLabels;
  /** Leave out for a kind that suggests no next question. */
  followUp?: (draft: DraftView, payload: P) => FollowUp | null;
}

/** What the card shows of one draft. */
export interface DraftPresentation {
  body: ReactElement;
  /** Null for a draft that is not shown in full, so it is not confirmed. */
  confirmLabel: string | null;
  notPermittedText: string;
  confirmInput: ConfirmInput;
  openInForm: OpenInForm | null;
  refreshKeys: RefreshKey[];
  resultLabels: ResultLabels;
  followUp: FollowUp | null;
}

function capFollowUp(followUp: FollowUp | null): FollowUp | null {
  return (
    followUp && {
      text: followUp.text,
      fingerprints: followUp.fingerprints.slice(0, MAX_FOLLOW_UP_FINGERPRINTS),
    }
  );
}

/** The draft as its kind's presenter shows it, or null if it can't. */
export function presentWith<P>(
  presenter: DraftPresenter<P>,
  draft: DraftView
): DraftPresentation | null {
  const payload = presenter.parse(draft);
  if (payload === null) {
    return null;
  }
  return {
    body: createElement(presenter.Body, { payload, draft }),
    confirmLabel: presenter.confirmLabel(payload),
    notPermittedText: presenter.notPermittedText,
    confirmInput: presenter.confirmInput?.(payload) ?? NO_CONFIRM_INPUT,
    openInForm: presenter.openInForm?.(payload, draft) ?? null,
    refreshKeys: presenter.refreshKeys(draft, payload),
    resultLabels: presenter.resultLabels,
    followUp: capFollowUp(presenter.followUp?.(draft, payload) ?? null),
  };
}

/**
 * Whether the card offers its form: only for a draft that could be confirmed
 * now (pending, not expired, not in read-only mode, where the form could not
 * save) and is permitted. `permitted` is the gateway's hint for the kind's
 * write scope, which the form needs too; a NOC user holds none of them.
 */
export function canOpenInForm(
  presentation: Pick<DraftPresentation, "openInForm">,
  draft: Pick<DraftView, "permitted">,
  state: CardState
): boolean {
  return !!presentation.openInForm && draft.permitted && state === "draft";
}

/** Why Confirm is disabled, if it is: the kind's own reason first. */
export function getConfirmBlockedReason(
  { confirmInput }: Pick<DraftPresentation, "confirmInput">,
  refusedReason: string | null
): string | null {
  return confirmInput.isBlocked ? confirmInput.reason : refusedReason;
}

/** Each key once, prefixes and exact keys apart, as the SWR helper takes them. */
export function splitRefreshKeys(keys: RefreshKey[]): {
  prefixes: string[];
  exact: string[];
} {
  const unique = (isExact: boolean) =>
    Array.from(
      new Set(
        keys.filter((key) => key.isExact === isExact).map(({ key }) => key)
      )
    );
  return { prefixes: unique(false), exact: unique(true) };
}
