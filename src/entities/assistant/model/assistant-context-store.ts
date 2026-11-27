import { create } from "zustand";

/** An alert ticked in the alerts table. Off-page ones have a fingerprint only. */
export interface SelectedAlert {
  fingerprint: string;
  name?: string;
  severity?: string;
  status?: string;
}

export const MAX_FOLLOW_UP_FINGERPRINTS = 20;

/**
 * The next question a draft card suggests: its text pre-fills the composer,
 * and its alerts become the selection, so they are sent as
 * `selected_fingerprints` and never as message text.
 */
export interface FollowUp {
  text: string;
  /** At most `MAX_FOLLOW_UP_FINGERPRINTS`; more are left out. */
  fingerprints: string[];
}

interface AssistantContextState {
  selection: SelectedAlert[];
  /** False after the user removed the selection from the next message. */
  selectionIncluded: boolean;
  /** Text for the composer, until the panel takes it. */
  composerPrefill: string | null;
  setSelection: (selection: SelectedAlert[]) => void;
  clearSelection: () => void;
  excludeSelection: () => void;
  includeSelection: () => void;
  startFollowUp: (followUp: FollowUp) => void;
  clearComposerPrefill: () => void;
}

const NO_SELECTION: SelectedAlert[] = [];

function hasSameFingerprints(a: SelectedAlert[], b: SelectedAlert[]): boolean {
  return (
    a.length === b.length &&
    a.every((alert, index) => alert.fingerprint === b[index].fingerprint)
  );
}

function isSame(a: SelectedAlert[], b: SelectedAlert[]): boolean {
  return (
    hasSameFingerprints(a, b) &&
    a.every(
      (alert, index) =>
        alert.name === b[index].name &&
        alert.severity === b[index].severity &&
        alert.status === b[index].status
    )
  );
}

/** What the user is looking at, for the next message. Never persisted. */
export const useAssistantContextStore = create<AssistantContextState>()(
  (set) => ({
    selection: NO_SELECTION,
    selectionIncluded: true,
    composerPrefill: null,
    setSelection: (selection) =>
      set((state) => {
        if (isSame(state.selection, selection)) {
          return state;
        }
        return {
          selection,
          // Ticking other alerts brings a removed selection back
          selectionIncluded:
            state.selectionIncluded ||
            !hasSameFingerprints(state.selection, selection),
        };
      }),
    clearSelection: () =>
      set({ selection: NO_SELECTION, selectionIncluded: true }),
    excludeSelection: () => set({ selectionIncluded: false }),
    includeSelection: () => set({ selectionIncluded: true }),
    startFollowUp: ({ text, fingerprints }) =>
      set({
        selection: fingerprints
          .slice(0, MAX_FOLLOW_UP_FINGERPRINTS)
          .map((fingerprint) => ({ fingerprint })),
        selectionIncluded: true,
        composerPrefill: text,
      }),
    clearComposerPrefill: () => set({ composerPrefill: null }),
  })
);
