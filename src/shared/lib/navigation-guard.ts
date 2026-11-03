import { create } from "zustand";

// Called with the navigation that was blocked; run `proceed` to carry it out.
export type NavigationBlocker = (proceed: () => void) => void;

type NavigationGuardState = {
  blocker: NavigationBlocker | null;
  setBlocker: (blocker: NavigationBlocker | null) => void;
};

// One page at a time can hold back navigation (e.g. a dashboard with unsaved
// edits). Code that navigates without a link goes through `confirmNavigation`.
export const useNavigationGuardStore = create<NavigationGuardState>()((set) => ({
  blocker: null,
  setBlocker: (blocker) => set({ blocker }),
}));

export function confirmNavigation(proceed: () => void) {
  const { blocker } = useNavigationGuardStore.getState();
  if (blocker) {
    blocker(proceed);
  } else {
    proceed();
  }
}
