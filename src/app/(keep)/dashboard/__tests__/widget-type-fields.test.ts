import { stripForeignTypeFields } from "../widget-type-fields";
import { PresetPanelType, WidgetData, WidgetType } from "../types";

const presetWidget = {
  i: "w1",
  x: 0,
  y: 0,
  w: 4,
  h: 4,
  name: "Critical",
  widgetType: WidgetType.PRESET,
  preset: { id: "p1", name: "feed" },
  presetPanelType: PresetPanelType.ALERT_COUNT_PANEL,
  showFiringOnly: true,
  thresholds: [{ value: 0, color: "#22c55e" }],
  customLink: "https://example.com",
} as unknown as WidgetData;

describe("stripForeignTypeFields", () => {
  it("drops preset fields when a preset widget becomes an image", () => {
    const result = stripForeignTypeFields(presetWidget, WidgetType.IMAGE);
    expect(result).not.toHaveProperty("preset");
    expect(result).not.toHaveProperty("presetPanelType");
    expect(result).not.toHaveProperty("showFiringOnly");
    expect(result).not.toHaveProperty("thresholds");
    expect(result).not.toHaveProperty("customLink");
  });

  it("keeps layout and identity fields", () => {
    const result = stripForeignTypeFields(presetWidget, WidgetType.HTML);
    expect(result).toMatchObject({ i: "w1", x: 0, y: 0, w: 4, h: 4, name: "Critical" });
  });

  it("keeps the fields a type shares with the previous type", () => {
    const result = stripForeignTypeFields(presetWidget, WidgetType.SERVICE_NOW);
    expect(result).not.toHaveProperty("preset");
    expect(result.thresholds).toEqual(presetWidget.thresholds);
    expect(result.customLink).toBe("https://example.com");
  });

  it("leaves a widget untouched when the type does not change", () => {
    expect(stripForeignTypeFields(presetWidget, WidgetType.PRESET)).toEqual(presetWidget);
  });

  it("drops image config when an image widget becomes a preset", () => {
    const imageWidget = {
      ...presetWidget,
      widgetType: WidgetType.IMAGE,
      image: { source: "url", url: "https://example.com/a.png", fit: "contain" },
    } as unknown as WidgetData;
    const result = stripForeignTypeFields(imageWidget, WidgetType.PRESET);
    expect(result).not.toHaveProperty("image");
  });

  it("does not mutate the input", () => {
    const copy = { ...presetWidget };
    stripForeignTypeFields(presetWidget, WidgetType.METRIC);
    expect(presetWidget).toEqual(copy);
  });

  it("drops countBy when a preset widget becomes another type but keeps it for presets", () => {
    const grouped = {
      ...presetWidget,
      countBy: { field: "incident", incidentStatus: "active" },
    } as unknown as WidgetData;

    expect(stripForeignTypeFields(grouped, WidgetType.IMAGE)).not.toHaveProperty(
      "countBy"
    );
    expect(stripForeignTypeFields(grouped, WidgetType.PRESET)).toHaveProperty(
      "countBy"
    );
  });
});
