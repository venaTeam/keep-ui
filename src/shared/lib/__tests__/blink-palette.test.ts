import {
  DEFAULT_BLINK_COLOR,
  contrastRatio,
  getBlinkStyle,
  getRowBlinkStyle,
} from "../blink-palette";

const rowVars = (color: string) =>
  getRowBlinkStyle(color) as Record<string, string>;

describe("getRowBlinkStyle", () => {
  it("tints a row in the default red, lighter than the solid strip", () => {
    const vars = rowVars(DEFAULT_BLINK_COLOR);

    expect(vars["--blink-strong"]).toBe("#f6c9c9");
    expect(vars["--blink-soft"]).toBe("#fce9e9");
    expect(vars["--blink-strong"]).not.toBe(
      (getBlinkStyle(DEFAULT_BLINK_COLOR) as Record<string, string>)[
        "--blink-strong"
      ]
    );
  });

  it.each(["#dc2626", "#2563eb", "#facc15", "#16a34a", "#ffffff", "#000000"])(
    "keeps the row text readable at every point of the %s pulse",
    (color) => {
      const vars = rowVars(color);

      expect(vars["--blink-strong-text"]).toBe(vars["--blink-soft-text"]);
      expect(
        contrastRatio(vars["--blink-strong-text"], vars["--blink-strong"])
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(vars["--blink-soft-text"], vars["--blink-soft"])
      ).toBeGreaterThanOrEqual(4.5);
    }
  );

  it("keeps the darker grey text of a row readable on the stronger tint", () => {
    expect(
      contrastRatio("#4b5563", rowVars(DEFAULT_BLINK_COLOR)["--blink-strong"])
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("lets borders follow the background, so only the tint pulses", () => {
    const vars = rowVars(DEFAULT_BLINK_COLOR);

    expect(vars["--blink-strong-border"]).toBe(vars["--blink-strong"]);
    expect(vars["--blink-soft-border"]).toBe(vars["--blink-soft"]);
  });

  it("sets only custom properties, leaving the still state to classes", () => {
    expect(
      Object.keys(getRowBlinkStyle(DEFAULT_BLINK_COLOR)).every((key) =>
        key.startsWith("--blink-")
      )
    ).toBe(true);
  });
});
