import { LayoutItem, WidgetData } from "./types";

export const applyEditedItemToLayout = (
  layout: LayoutItem[],
  updated: WidgetData
): LayoutItem[] =>
  layout.map((entry) => {
    if (entry.i !== updated.i) {
      return entry;
    }
    return {
      ...entry,
      ...(Number.isFinite(updated.h) ? { h: updated.h } : {}),
      ...(Number.isFinite(updated.minH) ? { minH: updated.minH } : {}),
    };
  });
