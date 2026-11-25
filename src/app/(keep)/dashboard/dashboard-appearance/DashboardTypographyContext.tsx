import React, { createContext, useContext } from "react";
import { useDashboardEditMode } from "../DashboardEditModeContext";
import type { WidgetData } from "../types";
import { WIDGET_FONT_STACKS } from "./fonts/widget-fonts";
import { TITLE_ONLY_TYPES } from "./title-only-types";
import {
  DEFAULT_WIDGET_TYPOGRAPHY,
  resolveWidgetTypography,
  typographyCardProps,
  TypographyCardProps,
  WidgetTypography,
} from "./widget-typography";

const DashboardTypographyContext = createContext<WidgetTypography | undefined>(
  undefined
);

/** Makes the dashboard-wide typography available to every widget on the canvas. */
export function DashboardTypographyProvider({
  value,
  children,
}: {
  value: WidgetTypography | undefined;
  children: React.ReactNode;
}) {
  return (
    <DashboardTypographyContext.Provider value={value}>
      {children}
    </DashboardTypographyContext.Provider>
  );
}

/** The dashboard-wide typography, or undefined outside a provider. */
export function useDashboardTypography(): WidgetTypography | undefined {
  return useContext(DashboardTypographyContext);
}

/**
 * Card attribute and inline style for a widget, from its override or the
 * dashboard setting. Title-only widget types never take a text size.
 */
export function useWidgetTypographyProps(item: WidgetData): TypographyCardProps {
  const dashboard = useDashboardTypography();
  const resolved = resolveWidgetTypography(item.typography, dashboard);
  return typographyCardProps(
    TITLE_ONLY_TYPES.has(item.widgetType)
      ? { ...resolved, size: DEFAULT_WIDGET_TYPOGRAPHY.size }
      : resolved,
    WIDGET_FONT_STACKS
  );
}

/** Small edit-mode pill marking a widget that overrides the dashboard typography. */
export function CustomTypeBadge({ active }: { active: boolean }) {
  const isEditMode = useDashboardEditMode();
  if (!isEditMode || !active) {
    return null;
  }
  return (
    <span
      className="ml-2 shrink-0 whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-2 py-px font-semibold text-orange-600"
      style={{ fontFamily: WIDGET_FONT_STACKS.system, fontSize: "10px", lineHeight: "14px" }}
      data-cy="dashboard-widget-custom-type"
    >
      Custom type
    </span>
  );
}
