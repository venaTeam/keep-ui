import {
  CHANGE_ALERT_STATUS_KIND,
  ChangeAlertStatusPayload,
  DraftView,
} from "@/entities/assistant";
import {
  ALERT_RESULT_LABELS,
  DraftPresentation,
  DraftPresenter,
  NO_CONFIRM_INPUT,
  presentWith,
  RefreshKey,
} from "../lib/draft-presenter";
import {
  getConfirmLabel,
  parseStatusChangePayload,
} from "../lib/status-change-draft";
import { GenericDraftBody } from "./GenericDraftBody";
import { StatusChangeDraftBody } from "./StatusChangeDraftBody";

// Every alerts query and the preset counters, by prefix
const ALERT_QUERY_KEYS: RefreshKey[] = [
  { key: "/alerts/query", isExact: false },
  { key: "/preset", isExact: false },
];

/** Whether the alerts may look different now. */
const hasChangedAlerts = ({ outcome }: DraftView) =>
  !!outcome && (outcome.applied_count > 0 || outcome.code === "unverified");

const statusChangePresenter: DraftPresenter<ChangeAlertStatusPayload> = {
  kind: CHANGE_ALERT_STATUS_KIND,
  tool: CHANGE_ALERT_STATUS_KIND,
  parse: parseStatusChangePayload,
  Body: StatusChangeDraftBody,
  confirmLabel: getConfirmLabel,
  notPermittedText: "You don't have permission to change alert status",
  refreshKeys: (draft) => (hasChangedAlerts(draft) ? ALERT_QUERY_KEYS : []),
  resultLabels: ALERT_RESULT_LABELS,
};

/**
 * One line for each kind of draft the assistant can make. (`any`: each
 * presenter has its own payload type, which only it reads.)
 */
const PRESENTERS: readonly DraftPresenter<any>[] = [statusChangePresenter];

const BY_KIND = new Map(
  PRESENTERS.map((presenter) => [presenter.kind, presenter])
);

/** The tools that make a draft, whose card shows while they run. */
export const DRAFT_TOOL_NAMES: readonly string[] = PRESENTERS.map(
  ({ tool }) => tool
);

function presentGeneric(draft: DraftView): DraftPresentation {
  return {
    body: <GenericDraftBody draft={draft} />,
    confirmLabel: null,
    notPermittedText: "You don't have permission to make this change",
    confirmInput: NO_CONFIRM_INPUT,
    openInForm: null,
    refreshKeys: [],
    resultLabels: ALERT_RESULT_LABELS,
    followUp: null,
  };
}

/**
 * The draft as its kind shows it. A kind this build does not know, or a
 * payload it can't read in full, is shown as it is and can't be confirmed.
 */
export function presentDraft(draft: DraftView): DraftPresentation {
  const presenter = BY_KIND.get(draft.kind);
  return (presenter && presentWith(presenter, draft)) ?? presentGeneric(draft);
}

/** What to revalidate now that the draft is final. */
export function getRefreshKeys(draft: DraftView): RefreshKey[] {
  return presentDraft(draft).refreshKeys;
}
