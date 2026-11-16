import { Column } from "@tanstack/react-table";
import { getCommonPinningStylesAndClassNames } from "../table-utils";

function fakeColumn(
  pinned: false | "left" | "right",
  pinnedIndex = 0,
  isLastLeft = false
): Column<any> {
  return {
    getIsPinned: () => pinned,
    getPinnedIndex: () => pinnedIndex,
    getIsLastColumn: () => isLastLeft,
    getStart: () => pinnedIndex * 50,
    getAfter: () => 0,
    getSize: () => 50,
  } as unknown as Column<any>;
}

describe("getCommonPinningStylesAndClassNames", () => {
  it("stacks left-pinned cells above scrolled cells, first column highest", () => {
    const first = getCommonPinningStylesAndClassNames(fakeColumn("left", 0), 4, 1);
    const last = getCommonPinningStylesAndClassNames(fakeColumn("left", 3, true), 4, 1);

    expect(first.style.zIndex).toBe(5);
    expect(last.style.zIndex).toBe(2);
    expect(first.style.left).toBe("0px");
    expect(first.className).toContain("sticky");
    expect(last.className).toContain("animate-scroll-shadow-left");
  });

  it("falls back to z-index 1 when the left pinned count is not given", () => {
    const { style } = getCommonPinningStylesAndClassNames(fakeColumn("left", 0));
    expect(style.zIndex).toBe(1);
  });

  it("leaves right-pinned cells without a z-index", () => {
    const { style, className } = getCommonPinningStylesAndClassNames(
      fakeColumn("right", 0),
      4,
      1
    );
    expect(style.zIndex).toBeUndefined();
    expect(style.right).toBe("0px");
    expect(className).toContain("sticky");
  });

  it("leaves unpinned cells without a z-index", () => {
    const { style, className } = getCommonPinningStylesAndClassNames(
      fakeColumn(false),
      4,
      1
    );
    expect(style.zIndex).toBeUndefined();
    expect(className).toContain("relative");
  });
});
