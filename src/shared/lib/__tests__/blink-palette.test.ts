import {
  DEFAULT_BLINK_COLOR,
  contrastRatio,
  getRowBlinkStyle,
} from "../blink-palette";

const tailwindConfig = require("../../../../tailwind.config.js");

const RED_500 = "#ef4444";
const WHITE = "#ffffff";
const ORANGE_50 = "#fff7ed";
const ORANGE_100 = "#ffedd5";
const ROW_TEXT = ["#333333", "#4b5563"];

const over = (color: string, alpha: number, base: string) =>
  composite(`rgb(${channels(color).join(" ")} / ${alpha})`, base, 1);

const SELECTED = over("#bfdbfe", 0.5, over("#bfdbfe", 0.5, WHITE));
const DRAG_SELECTING = over("#dbeafe", 0.5, over("#dbeafe", 0.5, WHITE));

const ROW_STATES: Array<[string, string, boolean]> = [
  ["default", WHITE, true],
  ["last viewed", ORANGE_50, true],
  ["hovered", ORANGE_100, false],
  ["selected", SELECTED, false],
  ["drag-selecting", DRAG_SELECTING, false],
];

const rowVars = (color: string) =>
  getRowBlinkStyle(color) as Record<string, string>;

const pulseOpacities = (): number[] =>
  Object.values(
    tailwindConfig.theme.extend.keyframes.ringingPulse as Record<
      string,
      { opacity: string }
    >
  ).map((frame) => Number(frame.opacity));

function channels(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function composite(tint: string, base: string, opacity: number) {
  const [, r, g, b, alpha] = tint
    .match(/^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/)!
    .map(Number);
  const weight = alpha * opacity;
  return (
    "#" +
    channels(base)
      .map((value, i) => [r, g, b][i] * weight + value * (1 - weight))
      .map((value) => Math.round(value).toString(16).padStart(2, "0"))
      .join("")
  );
}

const tint = () => rowVars(DEFAULT_BLINK_COLOR)["--blink-row-tint"];

const shownBackgrounds = (base: string, tintShown: boolean) =>
  pulseOpacities().map((opacity) =>
    tintShown ? composite(tint(), base, opacity) : base
  );

const ringingBackgrounds = () =>
  ROW_STATES.filter(([, , tintShown]) => tintShown).flatMap(([, base]) =>
    shownBackgrounds(base, true)
  );

describe("getRowBlinkStyle", () => {
  it("tints a ringing row at 10% of the color and edges it in the solid color", () => {
    const vars = rowVars(DEFAULT_BLINK_COLOR);

    expect(vars["--blink-row-tint"]).toBe("rgb(220 38 38 / 0.1)");
    expect(vars["--blink-row-edge"]).toBe(DEFAULT_BLINK_COLOR);
  });

  it("keeps red-500 marks at 3:1 or more on a ringing row at every phase of the pulse", () => {
    const backgrounds = ringingBackgrounds();

    expect(backgrounds).toContain("#fce9e9");
    backgrounds.forEach((background) =>
      expect(contrastRatio(RED_500, background)).toBeGreaterThanOrEqual(3)
    );
  });

  it.each(ROW_STATES)(
    "on a %s ringing row, shows red-500 marks at 3:1 or more wherever the tint shows, and the plain background as on dev where it is off",
    (_state, base, tintShown) => {
      shownBackgrounds(base, tintShown).forEach((background) => {
        if (tintShown) {
          expect(contrastRatio(RED_500, background)).toBeGreaterThanOrEqual(3);
        } else {
          expect(background).toBe(base);
        }
      });
    }
  );

  it.each(ROW_STATES.filter(([, , tintShown]) => !tintShown))(
    "turns the tint off on a %s row because it would take red-500 marks under 3:1",
    (_state, base) => {
      expect(contrastRatio(RED_500, composite(tint(), base, 1))).toBeLessThan(
        3
      );
    }
  );

  it("keeps the row's text at 4.5:1 or more at every phase of the pulse", () => {
    ringingBackgrounds().forEach((background) =>
      ROW_TEXT.forEach((text) =>
        expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5)
      )
    );
  });

  it("pulses in step with the Count feature's missing-blink", () => {
    const { keyframes, animation } = tailwindConfig.theme.extend;

    expect(Object.keys(keyframes.ringingPulse)).toEqual(
      Object.keys(keyframes.missingBlink)
    );
    expect(animation["ringing-pulse"].replace("ringingPulse", "")).toBe(
      animation["missing-blink"].replace("missingBlink", "")
    );
    expect(pulseOpacities()[0]).toBe(1);
  });

  it("sets only custom properties, leaving the pulse to classes", () => {
    expect(
      Object.keys(getRowBlinkStyle(DEFAULT_BLINK_COLOR)).every((key) =>
        key.startsWith("--blink-")
      )
    ).toBe(true);
  });
});
