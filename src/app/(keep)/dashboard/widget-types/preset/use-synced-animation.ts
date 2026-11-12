import { useCallback } from "react";

/**
 * Returns a ref callback that starts the element's CSS animations at the
 * page's time zero, so every element running the same animation is in step
 * however late it appeared. A new callback is returned when `enabled` changes,
 * which makes React run it again once the animation is switched on.
 */
export function useSyncedAnimation(enabled: boolean) {
  return useCallback(
    (element: HTMLElement | null) => {
      if (!enabled || typeof element?.getAnimations !== "function") {
        return;
      }
      element.getAnimations().forEach((animation) => {
        animation.startTime = 0;
      });
    },
    [enabled]
  );
}
