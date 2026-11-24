import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { isLinkIconColumn } from "@/widgets/alerts-table/lib/alert-link-columns";

/**
 * Where a widget row's quick-action tray sits when the row ends in link icon
 * columns: `left` of them, or over them at the row's `right` edge.
 */
export type TrayDock = "left" | "right";

/** The pointer positions, in client pixels, the tray's dock switches at. */
export interface TrayDockEdges {
  /** Left edge of the row's trailing link icon columns. */
  linkZoneLeft: number;
  /** Left edge of the tray when docked left. */
  trayLeft: number;
}

/**
 * The tray's dock, whether it got there by jumping instead of sliding, and
 * whether it must show icons only so that, docked right, it stays within the
 * link icon columns.
 */
export interface TrayPlacement {
  dock: TrayDock;
  instant: boolean;
  compact: boolean;
}

/** Gap, in pixels, between the left-docked tray and the link icon columns. */
export const TRAY_GAP_PX = 4;

/** How long, in milliseconds, after a dock change clicks on the tray or the link icons are swallowed. */
export const DOCK_CLICK_GUARD_MS = 200;

const INITIAL_PLACEMENT: TrayPlacement = {
  dock: "left",
  instant: true,
  compact: false,
};

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

/** Whether a table cell belongs to a link icon column. */
function isLinkIconCell(cell: Element | null): boolean {
  const columnId = (cell as HTMLElement | null)?.dataset.columnId;
  return columnId !== undefined && isLinkIconColumn(columnId);
}

/** The row's dock edges, from the row's right edge and the left-docked tray's width. */
function getDockEdges(
  row: HTMLElement,
  trayWidth: number,
  linkColumnsPx: number
): TrayDockEdges {
  const linkZoneLeft = row.getBoundingClientRect().right - linkColumnsPx;
  return { linkZoneLeft, trayLeft: linkZoneLeft - TRAY_GAP_PX - trayWidth };
}

/**
 * Whether the tray, docked left with its left edge at `trayLeft`, would cover
 * the content of any of the row's cells besides the link icon cells and its
 * own. A cell's content is measured with a Range and cut at the cell's edge.
 */
function wouldCoverContent(
  row: HTMLTableRowElement,
  tray: HTMLElement,
  trayLeft: number
): boolean {
  return Array.from(row.cells).some((cell) => {
    if (cell.contains(tray) || isLinkIconCell(cell)) {
      return false;
    }
    const range = document.createRange();
    range.selectNodeContents(cell);
    const content = range.getBoundingClientRect();
    if (content.width === 0 && content.height === 0) {
      return false;
    }
    return Math.min(content.right, cell.getBoundingClientRect().right) > trayLeft;
  });
}

/** Whether a click target is one of the tray's buttons or a link icon anchor of the row. */
function isGuardedTarget(
  row: HTMLElement,
  tray: HTMLElement,
  target: EventTarget | null
): boolean {
  const control =
    target instanceof Element ? target.closest("a, button") : null;
  if (!control || !row.contains(control)) {
    return false;
  }
  return (
    tray.contains(control) ||
    (control.tagName === "A" && isLinkIconCell(control.closest("td")))
  );
}

/**
 * Docks `tray` by the pointer over its row (`nextTrayDock`), when the row ends
 * in `linkColumnsPx` pixels of link icon columns and the left dock would
 * cover content of another cell; otherwise it stays left. Entering the row
 * places it at once, without sliding, before it shows. Leaving the row or
 * focusing into it by keyboard docks it left. For `DOCK_CLICK_GUARD_MS` after
 * a dock change, clicks on the tray's buttons and the link icons are
 * swallowed, so a click aimed before the move doesn't land on what slid in.
 * Docked right, the tray turns compact when its left-docked width, measured
 * on entry, would reach past the link icon columns.
 */
export function useTrayDock(
  tray: HTMLElement | null,
  linkColumnsPx: number
): TrayPlacement {
  const [placement, setPlacement] = useState<TrayPlacement>(INITIAL_PLACEMENT);
  const dockRef = useRef<TrayDock>(INITIAL_PLACEMENT.dock);

  useEffect(() => {
    const row = tray?.closest("tr");
    if (!tray || !row || linkColumnsPx <= 0) {
      return;
    }
    let canSlide: boolean | null = null;
    let trayWidth: number | null = null;
    let changedAt = -Infinity;
    const leftDockWidth = () => {
      trayWidth ??= tray.getBoundingClientRect().width;
      return trayWidth;
    };
    const place = (dock: TrayDock, instant: boolean) => {
      dockRef.current = dock;
      const compact =
        dock === "right" && leftDockWidth() + TRAY_GAP_PX > linkColumnsPx;
      setPlacement({ dock, instant, compact });
    };
    const onPointerEnter = (event: PointerEvent) => {
      trayWidth = null;
      const edges = getDockEdges(row, leftDockWidth(), linkColumnsPx);
      canSlide = wouldCoverContent(row, tray, edges.trayLeft);
      const dock = canSlide ? nextTrayDock("left", event.clientX, edges) : "left";
      flushSync(() => place(dock, true));
    };
    const onPointerMove = (event: PointerEvent) => {
      const edges = getDockEdges(row, leftDockWidth(), linkColumnsPx);
      if (canSlide === null) {
        canSlide = wouldCoverContent(row, tray, edges.trayLeft);
      }
      if (!canSlide) {
        return;
      }
      const next = nextTrayDock(dockRef.current, event.clientX, edges);
      if (next !== dockRef.current) {
        changedAt = performance.now();
        place(next, false);
      }
    };
    const onPointerLeave = () => {
      canSlide = null;
      trayWidth = null;
      place("left", true);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (
        (event.target as Element).matches(":focus-visible") &&
        dockRef.current !== "left"
      ) {
        place("left", false);
      }
    };
    const onClickCapture = (event: MouseEvent) => {
      if (
        performance.now() - changedAt < DOCK_CLICK_GUARD_MS &&
        isGuardedTarget(row, tray, event.target)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    row.addEventListener("pointerenter", onPointerEnter);
    row.addEventListener("pointermove", onPointerMove);
    row.addEventListener("pointerleave", onPointerLeave);
    row.addEventListener("focusin", onFocusIn);
    row.addEventListener("click", onClickCapture, true);
    return () => {
      row.removeEventListener("pointerenter", onPointerEnter);
      row.removeEventListener("pointermove", onPointerMove);
      row.removeEventListener("pointerleave", onPointerLeave);
      row.removeEventListener("focusin", onFocusIn);
      row.removeEventListener("click", onClickCapture, true);
    };
  }, [tray, linkColumnsPx]);

  return placement;
}
