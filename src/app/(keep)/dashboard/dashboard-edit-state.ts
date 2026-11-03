import { LayoutItem, WidgetData } from "./types";
import { DashboardAppearance } from "./dashboard-appearance/dashboard-appearance-validation";

export type DashboardEditState = {
  layout: LayoutItem[];
  widgetData: WidgetData[];
  appearance: DashboardAppearance;
  dashboardName: string;
};

/**
 * A comparable fingerprint of what the user can change while editing. Fields
 * the grid library or the page add on their own (drag flags, live preset
 * counts, resolved metrics) are left out so they never count as a change.
 */
export function dashboardEditKey(state: DashboardEditState): string {
  const layout = state.layout
    .map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
    .sort((a, b) => a.i.localeCompare(b.i));
  const widgets = state.widgetData.map((item) => {
    const {
      x, y, w, h, minW, minH, static: _static,
      moved, isDraggable, isResizable, isBounded, resizeHandles, maxW, maxH,
      preset, metric,
      ...rest
    } = item as WidgetData & Record<string, unknown>;
    return {
      ...rest,
      preset: preset ? { ...preset, alerts_count: undefined } : undefined,
      metric: metric?.id,
    };
  });
  return JSON.stringify({
    name: state.dashboardName,
    appearance: state.appearance,
    layout,
    widgets,
  });
}
