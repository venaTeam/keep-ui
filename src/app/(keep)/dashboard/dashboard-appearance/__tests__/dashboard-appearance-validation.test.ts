import {
  clampAppearance,
  DEFAULT_APPEARANCE,
  DENSITIES,
  DENSITY_MARGINS,
  densityMargin,
  isDensity,
  isHexColor,
  PRESET_THEMES,
} from "../dashboard-appearance-validation";

describe("isHexColor", () => {
  it.each(["#fff", "#ffffff", "#Aa0", "#12ab34", "#EEF2FB"])(
    "accepts %s",
    (value) => expect(isHexColor(value)).toBe(true)
  );
  it.each([
    "red",
    "#ff",
    "#gggggg",
    "#1234",
    "#12345g",
    "fff",
    "",
    "javascript:alert(1)",
    "rgb(0,0,0)",
  ])("rejects %s", (value) => expect(isHexColor(value)).toBe(false));
  it.each([null, undefined, 123, {}, ["#fff"]])(
    "rejects non-string %s",
    (value) => expect(isHexColor(value as unknown)).toBe(false)
  );
});

describe("isDensity", () => {
  it.each(["compact", "normal", "spacious"])("accepts %s", (value) =>
    expect(isDensity(value)).toBe(true)
  );
  it.each(["huge", "", "COMPACT", null, undefined, 3])(
    "rejects %s",
    (value) => expect(isDensity(value as unknown)).toBe(false)
  );
});

describe("clampAppearance", () => {
  it.each([null, undefined, "string", 123, []])(
    "returns an empty object for non-object %s",
    (raw) => expect(clampAppearance(raw as unknown)).toEqual({})
  );

  it("keeps a valid color and density, lowercasing the color", () => {
    expect(
      clampAppearance({ backgroundColor: "#EEF2FB", density: "compact" })
    ).toEqual({ backgroundColor: "#eef2fb", density: "compact" });
  });

  it("expands a 3-digit hex color to 6 digits so the color input can render it", () => {
    expect(clampAppearance({ backgroundColor: "#ABC" })).toEqual({
      backgroundColor: "#aabbcc",
    });
  });

  it("drops an invalid color", () => {
    expect(clampAppearance({ backgroundColor: "not-a-color" })).toEqual({});
  });

  it("drops an invalid density", () => {
    expect(clampAppearance({ density: "enormous" })).toEqual({});
  });

  it("ignores unknown keys so only structured values survive", () => {
    expect(
      clampAppearance({
        backgroundColor: "#fff",
        style: "position:fixed;top:0",
        onClick: "alert(1)",
      })
    ).toEqual({ backgroundColor: "#ffffff" });
  });
});

describe("densityMargin", () => {
  it("maps each density to its margin", () => {
    expect(densityMargin("compact")).toEqual([6, 6]);
    expect(densityMargin("normal")).toEqual([10, 10]);
    expect(densityMargin("spacious")).toEqual([16, 16]);
  });
  it("falls back to the normal margin for undefined or unknown values", () => {
    expect(densityMargin(undefined)).toEqual([10, 10]);
    expect(densityMargin("bogus" as unknown as never)).toEqual([10, 10]);
  });
});

describe("constants", () => {
  it("has an empty default appearance", () => {
    expect(DEFAULT_APPEARANCE).toEqual({});
  });
  it("covers every density with a margin", () => {
    for (const density of DENSITIES) {
      expect(DENSITY_MARGINS[density]).toHaveLength(2);
    }
  });
  it("only ships safe preset colors (a hex value or null)", () => {
    expect(PRESET_THEMES[0]).toEqual({ name: "None", backgroundColor: null });
    for (const preset of PRESET_THEMES) {
      if (preset.backgroundColor !== null) {
        expect(isHexColor(preset.backgroundColor)).toBe(true);
      }
    }
  });
});
