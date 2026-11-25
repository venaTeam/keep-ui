import { isLinkIconColumn } from "@/widgets/alerts-table/lib/alert-link-columns";

/** Whether a widget row's quick-action tray hangs below its row, sits above it, or sits inside it. */
export type TrayPlacement = "below" | "above" | "inside";

/** A row's and its tray's vertical extent, and the visible band, in client pixels. */
export interface TrayPlacementInput {
  rowTop: number;
  rowBottom: number;
  trayHeight: number;
  clipTop: number;
  clipBottom: number;
}

/** The dashboard card's preset container, where the walk for clipping ancestors stops. */
const WIDGET_CARD_SELECTOR = '[data-cy="dashboard-widget-preset"]';

/**
 * Where the tray goes: below its row when it fits above `clipBottom`, else
 * above the row when it fits below `clipTop`, else inside the row, as in a
 * one-row widget.
 */
export function getTrayPlacement({
  rowTop,
  rowBottom,
  trayHeight,
  clipTop,
  clipBottom,
}: TrayPlacementInput): TrayPlacement {
  if (clipBottom - rowBottom >= trayHeight) {
    return "below";
  }
  if (rowTop - clipTop >= trayHeight) {
    return "above";
  }
  return "inside";
}

/**
 * Rendered width, in pixels, of the run of link icon cells (Rule, Runbook)
 * that ends `row`, not counting the tray's own cell; 0 when there is none.
 */
function getTrailingLinkCellsWidth(
  row: HTMLTableRowElement,
  tray: HTMLElement
): number {
  let width = 0;
  const cells = Array.from(row.cells);
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    const cell = cells[index];
    if (cell.contains(tray)) {
      continue;
    }
    const columnId = cell.dataset.columnId;
    if (columnId === undefined || !isLinkIconColumn(columnId)) {
      break;
    }
    width += cell.getBoundingClientRect().width;
  }
  return width;
}

/**
 * Whether an element clips its content vertically: its vertical overflow is
 * anything but visible. Such an element clips a tray hanging out of it
 * whether or not its content overflows it now, so that isn't checked: a
 * hidden tray is parked inside its row and adds no overflow of its own.
 */
function clipsVertically(element: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(element);
  return overflowY !== "" && overflowY !== "visible";
}

/**
 * The visible vertical band around `element`: the viewport, cut by every
 * ancestor up to the widget card that clips (`clipsVertically`), such as the
 * Alert Table widget's rows area, which owns the vertical scroll.
 */
function getClipEdges(element: HTMLElement): { top: number; bottom: number } {
  let top = 0;
  let bottom = window.innerHeight;
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (clipsVertically(node)) {
      const rect = node.getBoundingClientRect();
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
    }
    if (node.matches(WIDGET_CARD_SELECTOR)) {
      break;
    }
  }
  return { top, bottom };
}

/**
 * Places `tray` below, above or inside `row` (`getTrayPlacement`), and ends it
 * where the row's trailing link icon cells start, so it never covers any
 * row's Rule or Runbook icons. Both are written straight to the tray
 * (`data-placement`, `style.right`), so a caller that shows the tray in the
 * same task gets it placed before it paints.
 */
export function placeTray(row: HTMLTableRowElement, tray: HTMLElement): void {
  const rowRect = row.getBoundingClientRect();
  const clip = getClipEdges(row);
  tray.dataset.placement = getTrayPlacement({
    rowTop: rowRect.top,
    rowBottom: rowRect.bottom,
    trayHeight: tray.getBoundingClientRect().height,
    clipTop: clip.top,
    clipBottom: clip.bottom,
  });
  const linkCellsWidth = getTrailingLinkCellsWidth(row, tray);
  if (linkCellsWidth > 0) {
    tray.style.right = `${linkCellsWidth}px`;
  } else {
    tray.style.removeProperty("right");
  }
}
