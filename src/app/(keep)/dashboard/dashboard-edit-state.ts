import { LayoutItem, WidgetData } from "./types";
import { DashboardAppearance } from "./dashboard-appearance/dashboard-appearance-validation";

export type DashboardEditState = {
  layout: LayoutItem[];
  widgetData: WidgetData[];
  appearance: DashboardAppearance;
  dashboardName: string;
};

/**
 * A comparable fingerprint of what the user can change while editing; it
 * decides whether leaving edit mode needs the "Discard unsaved changes?"
 * warning.
 *
 * Contract:
 * - Everything saved in `dashboard_config` counts: the name, the whole
 *   `appearance`, panel positions/sizes (`layout`: i, x, y, w, h) and every
 *   widget field.
 * - Widget fields are compared by EXCLUSION. The destructure below lists only
 *   fields that are not user edits: positions (already compared via `layout`),
 *   flags react-grid-layout adds (moved, isDraggable…), size limits, and data
 *   the page fills in itself (`preset.alerts_count`, the resolved `metric`).
 *   A new editable widget field is therefore compared automatically.
 * - When the grid or the page starts adding a field of its own, add it to
 *   that list; otherwise opening edit mode would report changes nobody made.
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
