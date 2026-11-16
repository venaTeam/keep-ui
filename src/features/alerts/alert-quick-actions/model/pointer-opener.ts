import type { MouseEvent } from "react";

/** The button a pointer press came from, or null when the keyboard or assistive technology pressed it (`detail` 0 or an empty `pointerType`), so that focus stays put. */
export function getPointerOpener(
  event: MouseEvent<HTMLElement>
): HTMLElement | null {
  const { pointerType } = event.nativeEvent as { pointerType?: string };
  return event.detail > 0 && pointerType !== "" ? event.currentTarget : null;
}

/**
 * Takes focus off the button a pointer opened a dialog from, so its row tray hides however the dialog was closed (Esc included).
 * Headless UI hands focus back in a microtask after the dialog unmounts, so the check waits one task; focus that moved elsewhere is left alone.
 */
export function releasePointerOpener(opener: HTMLElement | null): void {
  if (!opener) {
    return;
  }
  window.setTimeout(() => {
    if (opener.ownerDocument.activeElement === opener) {
      opener.blur();
    }
  });
}
