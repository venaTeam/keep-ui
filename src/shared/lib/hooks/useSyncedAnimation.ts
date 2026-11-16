import { useCallback } from "react";

/**
 * Returns a ref callback that starts the element's CSS animations at the
 * page's time zero, so every element running the same animation is in step
 * however late it appeared. A new callback is returned when `enabled` changes,
 * which makes React run it again once the animation is switched on. With
 * `pseudoElement` (e.g. `"::before"`), it syncs only the animations of that
 * pseudo-element of the element, leaving the element's own alone.
 */
export function useSyncedAnimation(enabled: boolean, pseudoElement?: string) {
  return useCallback(
    (element: HTMLElement | null) => {
      if (!enabled || typeof element?.getAnimations !== "function") {
        return;
      }
      const animations = pseudoElement
        ? element.getAnimations({ subtree: true }).filter((animation) => {
            const effect = animation.effect as KeyframeEffect | null;
            return (
              effect?.target === element &&
              effect.pseudoElement === pseudoElement
            );
          })
        : element.getAnimations();
      animations.forEach((animation) => {
        animation.startTime = 0;
      });
    },
    [enabled, pseudoElement]
  );
}
