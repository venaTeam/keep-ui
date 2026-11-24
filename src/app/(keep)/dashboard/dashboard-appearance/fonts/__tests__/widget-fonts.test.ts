import { WIDGET_FONTS, WIDGET_FONT_STACKS } from "../widget-fonts";
import { WIDGET_FONT_IDS } from "../../widget-typography";

describe("WIDGET_FONTS", () => {
  it.each(WIDGET_FONT_IDS)("defines %s with a label and a stack ending in a generic family", (id) => {
    expect(WIDGET_FONTS[id].label).toBeTruthy();
    expect(WIDGET_FONT_STACKS[id]).toMatch(/(sans-serif|monospace)$/);
  });

  it("carries the notes from the design", () => {
    expect(WIDGET_FONTS.system.note).toBe("current");
    expect(WIDGET_FONTS["atkinson-hyperlegible"].note).toBe("wall screens");
    expect(WIDGET_FONTS.rubik.note).toBe("Hebrew");
    expect(WIDGET_FONTS["jetbrains-mono"].note).toBe("monospace");
  });

  it("has no extra or missing ids", () => {
    expect(Object.keys(WIDGET_FONTS).sort()).toEqual([...WIDGET_FONT_IDS].sort());
  });
});
