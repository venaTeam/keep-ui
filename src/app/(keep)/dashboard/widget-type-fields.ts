import { WidgetData, WidgetType } from "./types";

const TYPE_FIELDS: Record<WidgetType, readonly string[]> = {
  [WidgetType.PRESET]: [
    "preset",
    "presetColumns",
    "thresholds",
    "presetPanelType",
    "showFiringOnly",
    "customLink",
  ],
  [WidgetType.METRIC]: ["metric"],
  [WidgetType.GENERICS_METRICS]: ["genericMetrics"],
  [WidgetType.SERVICE_NOW]: [
    "serviceNowTeam",
    "serviceNowStatus",
    "serviceNowDetection",
    "thresholds",
    "customLink",
  ],
  [WidgetType.IMAGE]: ["image"],
  [WidgetType.HTML]: ["html"],
};

/**
 * Returns a copy of the widget without the payload fields owned by other widget
 * types, so editing a widget into a different type does not leave the previous
 * type's panel rendering in the same card.
 */
export function stripForeignTypeFields(
  widget: WidgetData,
  type: WidgetType
): WidgetData {
  const owned = new Set(TYPE_FIELDS[type] ?? []);
  const result: Record<string, unknown> = { ...widget };
  Object.values(TYPE_FIELDS)
    .flat()
    .forEach((key) => {
      if (!owned.has(key)) {
        delete result[key];
      }
    });
  return result as unknown as WidgetData;
}
