import { useEffect } from "react";

/** Whether a widget row's quick-action tray hangs below its row or sits above it. */
export type TrayPlacement = "below" | "above";

/**
 * Where the tray goes: below its row, unless hanging there would reach past
 * `clipBottom`, the bottom edge, in client pixels, that would clip it.
 */
export function getTrayPlacement(
  rowBottom: number,
  trayHeight: number,
  clipBottom: number
): TrayPlacement {
  return rowBottom + trayHeight > clipBottom ? "above" : "below";
}

/**
 * The bottom edge that clips `element`: that of its nearest ancestor whose
 * vertical overflow is not visible, or the viewport's, whichever is higher.
 */
function getClipBottom(element: HTMLElement): number {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY !== "" && overflowY !== "visible") {
      return Math.min(node.getBoundingClientRect().bottom, window.innerHeight);
    }
  }
  return window.innerHeight;
}

/**
 * Places `tray` (`getTrayPlacement`) each time the pointer enters its row or
 * focus moves into it. The placement is written straight to the tray's
 * `data-placement`, so it lands in the same task, before the shown tray paints.
 */
export function useTrayPlacement(tray: HTMLElement | null): void {
  useEffect(() => {
    const row = tray?.closest("tr");
    if (!tray || !row) {
      return;
    }
    const place = () => {
      tray.dataset.placement = getTrayPlacement(
        row.getBoundingClientRect().bottom,
        tray.getBoundingClientRect().height,
        getClipBottom(row)
      );
    };
    row.addEventListener("pointerenter", place);
    row.addEventListener("focusin", place);
    return () => {
      row.removeEventListener("pointerenter", place);
      row.removeEventListener("focusin", place);
    };
  }, [tray]);
}
