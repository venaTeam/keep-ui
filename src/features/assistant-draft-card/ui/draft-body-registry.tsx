import { ReactElement } from "react";
import { CHANGE_ALERT_STATUS_KIND, DraftView } from "@/entities/assistant";
import {
  getConfirmLabel,
  parseStatusChangePayload,
} from "../lib/status-change-draft";
import { GenericDraftBody } from "./GenericDraftBody";
import { StatusChangeDraftBody } from "./StatusChangeDraftBody";

interface DraftPresentation {
  body: ReactElement;
  /** Null for a draft that is not shown in full, so it is not confirmed. */
  confirmLabel: string | null;
  notPermittedText: string;
}

type Presenter = (draft: DraftView) => DraftPresentation | null;

function presentStatusChange(draft: DraftView): DraftPresentation | null {
  const payload = parseStatusChangePayload(draft);
  return (
    payload && {
      body: <StatusChangeDraftBody payload={payload} />,
      confirmLabel: getConfirmLabel(payload),
      notPermittedText: "You don't have permission to change alert status",
    }
  );
}

/** One entry for each kind of draft the assistant can make. */
const PRESENTERS = new Map<string, Presenter>([
  [CHANGE_ALERT_STATUS_KIND, presentStatusChange],
]);

export function presentDraft(draft: DraftView): DraftPresentation {
  return (
    PRESENTERS.get(draft.kind)?.(draft) ?? {
      body: <GenericDraftBody draft={draft} />,
      confirmLabel: null,
      notPermittedText: "You don't have permission to make this change",
    }
  );
}
