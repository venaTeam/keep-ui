export type DashboardDensity = "compact" | "normal" | "spacious";

export interface DashboardAppearance {
  backgroundColor?: string;
  density?: DashboardDensity;
}

export interface PresetTheme {
  name: string;
  backgroundColor: string | null;
}

export const DENSITIES: DashboardDensity[] = ["compact", "normal", "spacious"];

export const DEFAULT_DENSITY: DashboardDensity = "normal";

/** Grid gap (react-grid-layout `margin`) for each density, in pixels. */
export const DENSITY_MARGINS: Record<DashboardDensity, [number, number]> = {
  compact: [6, 6],
  normal: [10, 10],
  spacious: [16, 16],
};

/** Named light-tint backgrounds; the inverted forms also read well in dark mode. `None` clears the color. */
export const PRESET_THEMES: PresetTheme[] = [
  { name: "None", backgroundColor: null },
  { name: "Slate", backgroundColor: "#eef2f7" },
  { name: "Ocean", backgroundColor: "#e6f2fb" },
  { name: "Forest", backgroundColor: "#eaf6ec" },
  { name: "Sunset", backgroundColor: "#fdeee6" },
  { name: "Graphite", backgroundColor: "#eceef1" },
];

export const DEFAULT_APPEARANCE: DashboardAppearance = {};

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** True only for a `#rgb`/`#rrggbb` string, so no free-form CSS value can reach the DOM. */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

/** True only for a known density keyword. */
export function isDensity(value: unknown): value is DashboardDensity {
  return (
    typeof value === "string" && (DENSITIES as string[]).includes(value)
  );
}

/**
 * Coerce an opaque persisted value into a safe appearance: only a validated hex
 * color and a known density survive, every other key is dropped.
 */
export function clampAppearance(raw: unknown): DashboardAppearance {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const source = raw as Record<string, unknown>;
  const result: DashboardAppearance = {};
  if (isHexColor(source.backgroundColor)) {
    result.backgroundColor = source.backgroundColor.toLowerCase();
  }
  if (isDensity(source.density)) {
    result.density = source.density;
  }
  return result;
}

/** The grid margin for a density, defaulting to the normal gap for missing or unknown values. */
export function densityMargin(density: unknown): [number, number] {
  return isDensity(density)
    ? DENSITY_MARGINS[density]
    : DENSITY_MARGINS[DEFAULT_DENSITY];
}
