import { useEffect, useState } from "react";

/**
 * Where a widget row's quick-action tray sits when the row ends in link icon
 * columns: `left` of them, or over them at the row's `right` edge.
 */
export type TrayDock = "left" | "right";

/** The pointer positions, in client pixels, the tray's dock switches at. */
export interface TrayDockEdges {
  /** Left edge of the row's trailing link icon columns. */
  linkZoneLeft: number;
  /** Left edge of the tray. */
  trayLeft: number;
}

/**
 * The tray's next dock for a pointer at `x`. Docked left, it moves right only
 * when the pointer is left of the tray, so the cells it covered can be read;
 * on the tray or the icons it stays. Docked right, it moves back left once
 * the pointer reaches the icons, so they can be clicked.
 */
export function nextTrayDock(
  current: TrayDock,
  x: number,
  { linkZoneLeft, trayLeft }: TrayDockEdges
): TrayDock {
  if (x >= linkZoneLeft) {
    return "left";
  }
  if (current === "left" && x < trayLeft) {
    return "right";
  }
  return current;
}

/**
 * Docks `tray` by the pointer over its row (`nextTrayDock`), when the row ends
 * in `linkColumnsPx` pixels of link icon columns. Leaving the row or focusing
 * into it by keyboard docks it left again.
 */
export function useTrayDock(
  tray: HTMLElement | null,
  linkColumnsPx: number
): TrayDock {
  const [dock, setDock] = useState<TrayDock>("left");

  useEffect(() => {
    const row = tray?.closest("tr");
    if (!tray || !row || linkColumnsPx <= 0) {
      return;
    }
    const onPointerMove = (event: PointerEvent) => {
      const edges = {
        linkZoneLeft: row.getBoundingClientRect().right - linkColumnsPx,
        trayLeft: tray.getBoundingClientRect().left,
      };
      setDock((current) => nextTrayDock(current, event.clientX, edges));
    };
    const dockLeft = () => setDock("left");
    const onFocusIn = (event: FocusEvent) => {
      if ((event.target as Element).matches(":focus-visible")) {
        dockLeft();
      }
    };
    row.addEventListener("pointermove", onPointerMove);
    row.addEventListener("pointerleave", dockLeft);
    row.addEventListener("focusin", onFocusIn);
    return () => {
      row.removeEventListener("pointermove", onPointerMove);
      row.removeEventListener("pointerleave", dockLeft);
      row.removeEventListener("focusin", onFocusIn);
    };
  }, [tray, linkColumnsPx]);

  return dock;
}
