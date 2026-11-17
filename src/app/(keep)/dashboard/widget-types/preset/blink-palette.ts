import { CountBy } from "@/entities/presets/model/count-by";
import { DEFAULT_BLINK_COLOR } from "@/shared/lib/blink-palette";
import {
  isHexColor,
  normalizeHexColor,
} from "../../dashboard-appearance/dashboard-appearance-validation";

export {
  DEFAULT_BLINK_COLOR,
  contrastRatio,
  getBlinkStyle,
} from "@/shared/lib/blink-palette";

/**
 * The color a widget's left-out alerts blink in: the saved one when it is a
 * hex color, red otherwise (including widgets saved before the choice existed).
 */
export function getBlinkColor(countBy?: CountBy): string {
  const color: unknown = countBy?.blinkColor;
  return isHexColor(color) ? normalizeHexColor(color) : DEFAULT_BLINK_COLOR;
}
