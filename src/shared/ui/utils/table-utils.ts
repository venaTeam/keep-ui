// Styles to make sticky column pinning work!
import { Column } from "@tanstack/react-table";
import { CSSProperties } from "react";
import clsx from "clsx";

/**
 * Sticky-pinning style and classes for a table cell.
 *
 * Every left-pinned cell gets the same z-index, 1, so cells that scroll
 * horizontally beneath them, which come later in the DOM, cannot paint on top,
 * while DOM order still decides among the pinned cells themselves: a later
 * row's pinned cell, and any non-portaled tooltip in it, paints over an earlier
 * row's. Right-pinned cells come last in the DOM and already paint over
 * scrolled cells, so they keep no z-index.
 */
export const getCommonPinningStylesAndClassNames = (
  column: Column<any>
): { style: CSSProperties; className: string } => {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");

  return {
    style: {
      left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
      right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
      width: column.getSize(),
      zIndex: isPinned === "left" ? 1 : undefined,
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
