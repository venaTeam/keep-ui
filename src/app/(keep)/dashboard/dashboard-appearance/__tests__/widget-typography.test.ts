import {
  clampWidgetOverride,
  clampWidgetTypography,
  DEFAULT_WIDGET_TYPOGRAPHY,
  fullOverrideFrom,
  isDefaultTypography,
  resolveWidgetTypography,
  typographyCardProps,
  WidgetFontId,
  WIDGET_FONT_IDS,
} from "../widget-typography";
import { clampAppearance } from "../dashboard-appearance-validation";

const STACKS = Object.fromEntries(
  WIDGET_FONT_IDS.map((id) => [id, `stack-${id}`])
) as Record<WidgetFontId, string>;

describe("clampWidgetTypography", () => {
  it.each([null, undefined, "inter", 3, [], ["inter"]])(
    "returns an empty object for non-object %s",
    (raw) => expect(clampWidgetTypography(raw as unknown)).toEqual({})
  );

  it("keeps valid fields and drops unknown values", () => {
    expect(
      clampWidgetTypography({ font: "comic-sans", size: "xl", title: 7 })
    ).toEqual({ size: "xl" });
  });

  it("drops fields equal to the default", () => {
    expect(
      clampWidgetTypography({ font: "system", size: "sm", title: "large" })
    ).toEqual({ title: "large" });
  });

  it("ignores unknown keys", () => {
    expect(
      clampWidgetTypography({ font: "inter", color: "red", style: "x" })
    ).toEqual({ font: "inter" });
  });
});

describe("clampWidgetOverride", () => {
  it.each([null, undefined, "inter", 3, []])(
    "means no override for non-object %s",
    (raw) => expect(clampWidgetOverride(raw as unknown)).toBeUndefined()
  );

  it("keeps an all-default override as a full override", () => {
    expect(
      clampWidgetOverride({ font: "system", size: "sm", title: "normal" })
    ).toEqual(DEFAULT_WIDGET_TYPOGRAPHY);
  });

  it("fills invalid fields with the default", () => {
    expect(clampWidgetOverride({ font: "bad", size: "lg" })).toEqual({
      font: "system",
      size: "lg",
      title: "normal",
    });
  });
});

describe("resolveWidgetTypography", () => {
  it("uses the defaults when nothing is set", () => {
    expect(resolveWidgetTypography(undefined, undefined)).toEqual(
      DEFAULT_WIDGET_TYPOGRAPHY
    );
  });

  it("fills dashboard fields over the defaults", () => {
    expect(resolveWidgetTypography(undefined, { size: "xl" })).toEqual({
      font: "system",
      size: "xl",
      title: "normal",
    });
  });

  it("lets a widget override win as a whole over the dashboard", () => {
    expect(
      resolveWidgetTypography(
        { font: "inter", size: "sm", title: "normal" },
        { size: "xl", title: "large" }
      )
    ).toEqual({ font: "inter", size: "sm", title: "normal" });
  });
});

describe("fullOverrideFrom", () => {
  it("seeds all three fields from the dashboard's effective values", () => {
    expect(fullOverrideFrom({ font: "rubik" })).toEqual({
      font: "rubik",
      size: "sm",
      title: "normal",
    });
  });
});

describe("isDefaultTypography", () => {
  it("is true only for the defaults", () => {
    expect(isDefaultTypography(DEFAULT_WIDGET_TYPOGRAPHY)).toBe(true);
    expect(
      isDefaultTypography({ ...DEFAULT_WIDGET_TYPOGRAPHY, title: "xl" })
    ).toBe(false);
  });
});

describe("typographyCardProps", () => {
  it("returns nothing for the defaults so the card renders as today", () => {
    expect(typographyCardProps(DEFAULT_WIDGET_TYPOGRAPHY, STACKS)).toEqual({});
  });

  it("sets only the scale when only the size differs", () => {
    expect(
      typographyCardProps({ font: "system", size: "lg", title: "normal" }, STACKS)
    ).toEqual({
      "data-widget-typography": "",
      style: { "--wt-scale": "1.3333", fontSize: "calc(1rem * 1.3333)" },
    });
  });

  it("sets the font stack and title when they differ", () => {
    expect(
      typographyCardProps({ font: "inter", size: "sm", title: "xl" }, STACKS)
    ).toEqual({
      "data-widget-typography": "",
      style: {
        fontFamily: "stack-inter",
        "--wt-title-scale": "1.65",
      },
    });
  });
});

describe("clampAppearance typography", () => {
  it("keeps valid typography and drops invalid fields", () => {
    expect(
      clampAppearance({ typography: { size: "xl", font: "bad" } })
    ).toEqual({ typography: { size: "xl" } });
  });

  it("drops typography that holds only defaults", () => {
    expect(clampAppearance({ typography: { size: "sm" } })).toEqual({});
  });

  it("drops non-object typography", () => {
    expect(clampAppearance({ typography: "huge" })).toEqual({});
  });
});
