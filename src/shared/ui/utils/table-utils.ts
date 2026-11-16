// Styles to make sticky column pinning work!
import { Column } from "@tanstack/react-table";
import { CSSProperties } from "react";
import clsx from "clsx";

/**
 * Sticky-pinning style and classes for a table cell.
 *
 * Left-pinned cells carry a z-index (highest for the first pinned column) so
 * cells that scroll horizontally beneath them, which come later in the DOM,
 * cannot paint on top. Right-pinned cells come last in the DOM and already
 * paint over scrolled cells, so they keep no z-index and any non-portaled
 * popover inside them stays unconfined.
 */
export const getCommonPinningStylesAndClassNames = (
  column: Column<any>,
  leftPinnedColumnsCount?: number,
  rightPinnedColumnsCount?: number
): { style: CSSProperties; className: string } => {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");

  const zIndex = (() => {
    if (isPinned === "left") {
      return leftPinnedColumnsCount
        ? leftPinnedColumnsCount + 1 - column.getPinnedIndex()
        : 1;
    }
    if (isPinned === "right") {
      return rightPinnedColumnsCount
        ? rightPinnedColumnsCount + 1 - column.getPinnedIndex()
        : 1;
    }
    return undefined;
  })();

  return {
    style: {
      left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
      right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
      width: column.getSize(),
      zIndex: isPinned === "left" ? zIndex : undefined,
      animationTimeline: "scroll(inline)",
    },
    className: clsx(
      "bg-tremor-background",
      isPinned ? "sticky" : "relative",
      isPinned === "left" && isLastLeftPinnedColumn
        ? "animate-scroll-shadow-left"
        : undefined,
      isPinned === "right" ? "animate-scroll-shadow-right" : undefined
    ),
  };
};
