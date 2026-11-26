import { create } from "zustand";

/** An alert ticked in the alerts table. Off-page ones have a fingerprint only. */
export interface SelectedAlert {
  fingerprint: string;
  name?: string;
  severity?: string;
  status?: string;
}

interface AssistantContextState {
  selection: SelectedAlert[];
  /** False after the user removed the selection from the next message. */
  selectionIncluded: boolean;
  setSelection: (selection: SelectedAlert[]) => void;
  clearSelection: () => void;
  excludeSelection: () => void;
  includeSelection: () => void;
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
  })
);
