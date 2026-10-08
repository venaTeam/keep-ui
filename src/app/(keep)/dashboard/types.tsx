import { MetricsWidget } from "@/utils/hooks/useDashboardMetricWidgets";
import { Preset } from "@/entities/presets/model/types";
import { CountBy } from "@/entities/presets/model/count-by";

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  static: boolean;
}

export interface GenericsMetrics {
  key: string;
  label: string;
  widgetType: "table" | "chart";
  meta: {
    defaultFilters: {
      [key: string]: string | string[];
    };
  };
}

export enum WidgetType {
  PRESET = "PRESET",
  METRIC = "METRIC",
  GENERICS_METRICS = "GENERICS_METRICS",
  SERVICE_NOW = "SERVICE_NOW",
  IMAGE = "IMAGE",
  HTML = "HTML",
}

export type ImageFit = "contain" | "cover";

export interface ImageWidgetConfig {
  source: "upload" | "url";
  imageId?: string;
  url?: string;
  fit: ImageFit;
  link?: string;
}

export interface HtmlWidgetConfig {
  html: string;
}

export enum PresetPanelType {
  ALERT_TABLE = "ALERT_TABLE",
  ALERT_COUNT_PANEL = "ALERT_COUNT_PANEL",
}

export interface WidgetData extends LayoutItem {
  thresholds?: Threshold[];
  preset?: Preset;
  name: string;
  widgetType: WidgetType;
  // Service Now widget config
  serviceNowTeam?: string;
  serviceNowStatus?: "open" | "in_progress" | "both";
  serviceNowDetection?: "direct" | "hamal" | "all";
  genericMetrics?: GenericsMetrics;
  metric?: MetricsWidget;
  presetPanelType?: PresetPanelType;
  showFiringOnly?: boolean;
  customLink?: string;
  countBy?: CountBy;
  image?: ImageWidgetConfig;
  html?: HtmlWidgetConfig;
}

export interface Threshold {
  value: number;
  color: string;
}
