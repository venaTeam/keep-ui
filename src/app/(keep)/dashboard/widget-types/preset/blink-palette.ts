import type { CSSProperties } from "react";
import { CountBy } from "@/entities/presets/model/count-by";
import {
  isHexColor,
  normalizeHexColor,
} from "../../dashboard-appearance/dashboard-appearance-validation";

export const DEFAULT_BLINK_COLOR = "#dc2626";

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const SOFT_TINT = 0.15;
const READABLE_CONTRAST = 4.5;

const toRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const toHex = (rgb: Rgb) =>
  "#" +
  rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

const mix = (color: Rgb, other: Rgb, weightOfColor: number): Rgb =>
  color.map((v, i) => v * weightOfColor + other[i] * (1 - weightOfColor)) as Rgb;

const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: Rgb, b: Rgb) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** WCAG contrast ratio between two `#rrggbb` colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  return contrast(toRgb(a), toRgb(b));
}

/**
 * The color a widget's left-out alerts blink in: the saved one when it is a
 * hex color, red otherwise (including widgets saved before the choice existed).
 */
export function getBlinkColor(countBy?: CountBy): string {
  const color: unknown = countBy?.blinkColor;
  return isHexColor(color) ? normalizeHexColor(color) : DEFAULT_BLINK_COLOR;
}

/**
 * Inline style for a blinking strip or label in `color`. The animation fades
 * between a solid phase (the color with white or black text, whichever reads
 * better) and a light tint of it with a dark shade of it as text; both phases
 * keep the text at 4.5:1 or more. The style itself is the solid phase, which
 * is what shows when the animation is off (reduced motion).
 */
export function getBlinkStyle(color: string): CSSProperties {
  const strong = toRgb(color);
  const strongText =
    contrast(WHITE, strong) >= contrast(BLACK, strong) ? WHITE : BLACK;
  const soft = mix(strong, WHITE, SOFT_TINT);
  let softText = strong;
  for (
    let weight = 0.8;
    contrast(softText, soft) < READABLE_CONTRAST;
    weight -= 0.1
  ) {
    softText = weight > 0 ? mix(strong, BLACK, weight) : BLACK;
  }
  const vars = {
    "--blink-strong": toHex(strong),
    "--blink-strong-text": toHex(strongText),
    "--blink-strong-border": toHex(mix(strong, BLACK, 0.85)),
    "--blink-soft": toHex(soft),
    "--blink-soft-text": toHex(softText),
    "--blink-soft-border": toHex(mix(strong, WHITE, 0.4)),
  };
  return {
    ...vars,
    backgroundColor: vars["--blink-strong"],
    color: vars["--blink-strong-text"],
    borderColor: vars["--blink-strong-border"],
  } as CSSProperties;
}
