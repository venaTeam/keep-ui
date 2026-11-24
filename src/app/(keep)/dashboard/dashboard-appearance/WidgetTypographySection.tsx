import React from "react";
import { Switch, Text } from "@tremor/react";
import { WidgetType } from "../types";
import { WIDGET_FONTS } from "./fonts/widget-fonts";
import { TypographyControls } from "./TypographyControls";
import {
  fullOverrideFrom,
  resolveWidgetTypography,
  WIDGET_TEXT_SIZES,
  WIDGET_TITLE_SIZES,
  WidgetTypography,
} from "./widget-typography";

const TITLE_ONLY_TYPES = new Set<WidgetType>([
  WidgetType.IMAGE,
  WidgetType.HTML,
  WidgetType.GRAFANA_PANEL,
]);

const SWITCH_ID = "dashboard-widget-typography-switch";

/** One-line description of the dashboard setting a widget follows when it has no override. */
export function describeTypography(dashboard: WidgetTypography | undefined): string {
  const t = resolveWidgetTypography(undefined, dashboard);
  const size = WIDGET_TEXT_SIZES.find((s) => s.id === t.size)?.label ?? t.size;
  const title = WIDGET_TITLE_SIZES.find((s) => s.id === t.title)?.label ?? t.title;
  return `${WIDGET_FONTS[t.font].label} · ${size} text · ${title} titles`;
}

/**
 * Typography section of the Edit Widget modal. `value` undefined means the
 * widget follows the dashboard; turning the switch on seeds a full override
 * from the dashboard's effective values, turning it off reports undefined.
 */
export function WidgetTypographySection({
  value,
  dashboard,
  widgetType,
  widgetName,
  onChange,
}: {
  value: WidgetTypography | undefined;
  dashboard: WidgetTypography | undefined;
  widgetType: WidgetType;
  widgetName?: string;
  onChange: (next: WidgetTypography | undefined) => void;
}) {
  const isCustom = value !== undefined;

  return (
    <div
      className="mb-4 mt-6 border-t border-gray-200 pt-4"
      data-cy="dashboard-widget-typography"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-gray-900">Typography</span>
        <div className="flex items-center gap-2">
          <label htmlFor={SWITCH_ID} className="text-sm text-gray-500">
            Custom for this widget
          </label>
          <Switch
            id={SWITCH_ID}
            checked={isCustom}
            onChange={(checked) =>
              onChange(checked ? fullOverrideFrom(dashboard) : undefined)
            }
            data-cy="dashboard-widget-typography-switch"
          />
        </div>
      </div>
      {isCustom ? (
        <div className="mt-3">
          {TITLE_ONLY_TYPES.has(widgetType) && (
            <Text className="mb-2 text-xs">Applies to the title only.</Text>
          )}
          <TypographyControls
            value={value}
            onChange={(next) => onChange(resolveWidgetTypography(next, undefined))}
            fontPicker="select"
            idPrefix="dashboard-widget-typography"
            previewTitle={widgetName || undefined}
          />
        </div>
      ) : (
        <Text className="mt-1 text-xs" data-cy="dashboard-widget-typography-inherit">
          Uses the dashboard setting: {describeTypography(dashboard)}. Change it
          for all widgets in Customize.
        </Text>
      )}
    </div>
  );
}
