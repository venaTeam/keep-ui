import { CountBy } from "@/entities/presets/model/count-by";
import {
  DEFAULT_BLINK_COLOR,
  contrastRatio,
  getBlinkColor,
  getBlinkStyle,
} from "../blink-palette";

const incidents: CountBy = { field: "incident", showMissing: true };

describe("getBlinkColor", () => {
  it.each<[string, unknown, string]>([
    ["no saved color", undefined, "#dc2626"],
    ["a saved color", "#2563eb", "#2563eb"],
    ["an upper-case color", "#2563EB", "#2563eb"],
    ["a short color", "#0af", "#00aaff"],
    ["a color name", "red", "#dc2626"],
    ["an empty string", "", "#dc2626"],
    ["a number", 255, "#dc2626"],
  ])("uses %s -> %s", (_name, blinkColor, expected) => {
    expect(
      getBlinkColor({ ...incidents, blinkColor } as unknown as CountBy)
    ).toBe(expected);
  });

  it("defaults to red without a countBy", () => {
    expect(getBlinkColor(undefined)).toBe(DEFAULT_BLINK_COLOR);
    expect(DEFAULT_BLINK_COLOR).toBe("#dc2626");
  });
});

describe("contrastRatio", () => {
  it("measures black on white as 21 and a color on itself as 1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#dc2626", "#dc2626")).toBeCloseTo(1, 5);
  });
});

describe("getBlinkStyle", () => {
  const vars = (color: string) => {
    const style = getBlinkStyle(color) as Record<string, string>;
    return {
      strong: style["--blink-strong"],
      strongText: style["--blink-strong-text"],
      soft: style["--blink-soft"],
      softText: style["--blink-soft-text"],
      style,
    };
  };

  it("keeps the default red: solid red with white text", () => {
    const { strong, strongText, style } = vars("#dc2626");

    expect(strong).toBe("#dc2626");
    expect(strongText).toBe("#ffffff");
    expect(style.backgroundColor).toBe("#dc2626");
    expect(style.color).toBe("#ffffff");
    expect(style.borderColor).toBe(style["--blink-strong-border"]);
  });

  it("starts in the solid phase, so a still strip (reduced motion) shows the chosen color", () => {
    const { style } = vars("#2563eb");

    expect(style.backgroundColor).toBe("#2563eb");
    expect(style.color).toBe(style["--blink-strong-text"]);
  });

  it("uses dark text on a light color and white text on a dark one", () => {
    expect(vars("#facc15").strongText).toBe("#000000");
    expect(vars("#ffffff").strongText).toBe("#000000");
    expect(vars("#2563eb").strongText).toBe("#ffffff");
    expect(vars("#000000").strongText).toBe("#ffffff");
  });

  it.each(["#dc2626", "#2563eb", "#facc15", "#16a34a", "#ffffff", "#000000", "#e5e7eb"])(
    "keeps both phases of %s readable",
    (color) => {
      const { strong, strongText, soft, softText } = vars(color);

      expect(contrastRatio(strongText, strong)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(softText, soft)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it("fades to a light tint of the same color", () => {
    const { soft } = vars("#2563eb");

    expect(soft).not.toBe("#2563eb");
    expect(contrastRatio(soft, "#ffffff")).toBeLessThan(1.3);
  });
});
