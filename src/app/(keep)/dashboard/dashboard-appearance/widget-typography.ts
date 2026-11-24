import type { CSSProperties } from "react";

export type WidgetFontId =
  | "system"
  | "inter"
  | "roboto"
  | "ibm-plex-sans"
  | "source-sans-3"
  | "atkinson-hyperlegible"
  | "rubik"
  | "jetbrains-mono";

export type WidgetTextSize = "sm" | "md" | "lg" | "xl" | "2xl";

export type WidgetTitleSize = "normal" | "large" | "xl";

/**
 * Typography for dashboard widgets, stored on `dashboard_config.appearance`
 * (whole dashboard) or on a single `WidgetData` (override). Absent fields mean
 * the default; defaults are never stored.
 */
export interface WidgetTypography {
  font?: WidgetFontId;
  size?: WidgetTextSize;
  title?: WidgetTitleSize;
}

export type ResolvedWidgetTypography = Required<WidgetTypography>;

export interface TypographyStep<T extends string> {
  id: T;
  label: string;
  factor: number;
}

export const WIDGET_FONT_IDS: WidgetFontId[] = [
  "system",
  "inter",
  "roboto",
  "ibm-plex-sans",
  "source-sans-3",
  "atkinson-hyperlegible",
  "rubik",
  "jetbrains-mono",
];

/** Text-size steps; each factor multiplies the size a widget renders today. */
export const WIDGET_TEXT_SIZES: TypographyStep<WidgetTextSize>[] = [
  { id: "sm", label: "S", factor: 1 },
  { id: "md", label: "M", factor: 8 / 7 },
  { id: "lg", label: "L", factor: 4 / 3 },
  { id: "xl", label: "XL", factor: 32 / 21 },
  { id: "2xl", label: "2XL", factor: 40 / 21 },
];

/** Title-size steps; each factor multiplies today's `text-lg` title. */
export const WIDGET_TITLE_SIZES: TypographyStep<WidgetTitleSize>[] = [
  { id: "normal", label: "Normal", factor: 1 },
  { id: "large", label: "Large", factor: 1.27 },
  { id: "xl", label: "XL", factor: 1.65 },
];

export const DEFAULT_WIDGET_TYPOGRAPHY: ResolvedWidgetTypography = {
  font: "system",
  size: "sm",
  title: "normal",
};

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

const TEXT_SIZE_IDS = WIDGET_TEXT_SIZES.map((s) => s.id);
const TITLE_SIZE_IDS = WIDGET_TITLE_SIZES.map((s) => s.id);

/**
 * Coerce a persisted typography object into one the UI can render: only
 * allowlisted values survive and fields equal to the default are dropped.
 */
export function clampWidgetTypography(raw: unknown): WidgetTypography {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const source = raw as Record<string, unknown>;
  const result: WidgetTypography = {};
  if (
    isOneOf(source.font, WIDGET_FONT_IDS) &&
    source.font !== DEFAULT_WIDGET_TYPOGRAPHY.font
  ) {
    result.font = source.font;
  }
  if (
    isOneOf(source.size, TEXT_SIZE_IDS) &&
    source.size !== DEFAULT_WIDGET_TYPOGRAPHY.size
  ) {
    result.size = source.size;
  }
  if (
    isOneOf(source.title, TITLE_SIZE_IDS) &&
    source.title !== DEFAULT_WIDGET_TYPOGRAPHY.title
  ) {
    result.title = source.title;
  }
  return result;
}

/**
 * Coerce a persisted per-widget override. Any plain object is an override and
 * comes back complete (invalid or missing fields take the default), so an
 * override that holds only defaults still pins the widget to them; anything
 * else means "no override".
 */
export function clampWidgetOverride(
  raw: unknown
): ResolvedWidgetTypography | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  return { ...DEFAULT_WIDGET_TYPOGRAPHY, ...clampWidgetTypography(raw) };
}

/**
 * Effective typography for one widget: a widget override replaces the
 * dashboard setting as a whole; otherwise dashboard fields fill in over the
 * defaults.
 */
export function resolveWidgetTypography(
  widget: WidgetTypography | undefined,
  dashboard: WidgetTypography | undefined
): ResolvedWidgetTypography {
  const source = widget ?? dashboard ?? {};
  return { ...DEFAULT_WIDGET_TYPOGRAPHY, ...source };
}

/** True when the resolved typography renders exactly like today. */
export function isDefaultTypography(t: ResolvedWidgetTypography): boolean {
  return (
    t.font === DEFAULT_WIDGET_TYPOGRAPHY.font &&
    t.size === DEFAULT_WIDGET_TYPOGRAPHY.size &&
    t.title === DEFAULT_WIDGET_TYPOGRAPHY.title
  );
}

/** Full override seeded from the dashboard's effective values, used when a widget's switch is turned on. */
export function fullOverrideFrom(
  dashboard: WidgetTypography | undefined
): ResolvedWidgetTypography {
  return resolveWidgetTypography(undefined, dashboard);
}

/** The multiplier for a text-size step. */
export function textSizeFactor(size: WidgetTextSize): number {
  return WIDGET_TEXT_SIZES.find((s) => s.id === size)?.factor ?? 1;
}

/** The multiplier for a title-size step. */
export function titleSizeFactor(title: WidgetTitleSize): number {
  return WIDGET_TITLE_SIZES.find((s) => s.id === title)?.factor ?? 1;
}

export interface TypographyCardProps {
  "data-widget-typography"?: "";
  style?: CSSProperties;
}

/**
 * Attribute and inline style for a widget card. Defaults yield `{}` so an
 * untouched widget renders exactly as before; otherwise only the properties
 * that differ from the default are set.
 */
export function typographyCardProps(
  t: ResolvedWidgetTypography,
  fontStacks: Record<WidgetFontId, string>
): TypographyCardProps {
  if (isDefaultTypography(t)) {
    return {};
  }
  const style: Record<string, string> = {};
  if (t.font !== DEFAULT_WIDGET_TYPOGRAPHY.font) {
    style.fontFamily = fontStacks[t.font];
  }
  if (t.size !== DEFAULT_WIDGET_TYPOGRAPHY.size) {
    const factor = textSizeFactor(t.size).toFixed(4);
    style["--wt-scale"] = factor;
    style.fontSize = `calc(1rem * ${factor})`;
  }
  if (t.title !== DEFAULT_WIDGET_TYPOGRAPHY.title) {
    style["--wt-title-scale"] = String(titleSizeFactor(t.title));
  }
  return { "data-widget-typography": "", style: style as CSSProperties };
}
