import { create } from "zustand";

// Called with the navigation that was blocked; run `proceed` to carry it out.
export type NavigationBlocker = (proceed: () => void) => void;

type NavigationGuardState = {
  // Active guards, oldest first. The newest one decides; removing one leaves
  // the others in place, so guards never overwrite each other.
  blockers: NavigationBlocker[];
  addBlocker: (blocker: NavigationBlocker) => () => void;
};

// Pages with unsaved changes register a blocker here. Code that navigates
// without a link goes through `confirmNavigation`.
export const useNavigationGuardStore = create<NavigationGuardState>()((set) => ({
  blockers: [],
  addBlocker: (blocker) => {
    set((state) => ({ blockers: [...state.blockers, blocker] }));
    return () =>
      set((state) => ({
        blockers: state.blockers.filter((b) => b !== blocker),
      }));
  },
}));

export function confirmNavigation(proceed: () => void) {
  const { blockers } = useNavigationGuardStore.getState();
  const blocker = blockers[blockers.length - 1];
  if (blocker) {
    blocker(proceed);
  } else {
    proceed();
  }
}
