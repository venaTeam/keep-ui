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
  it("lifts every left-pinned cell above scrolled cells with the same z-index", () => {
    const first = getCommonPinningStylesAndClassNames(fakeColumn("left", 0));
    const last = getCommonPinningStylesAndClassNames(
      fakeColumn("left", 3, true)
    );

    expect(first.style.zIndex).toBe(1);
    expect(last.style.zIndex).toBe(1);
    expect(first.style.left).toBe("0px");
    expect(first.className).toContain("sticky");
    expect(last.className).toContain("animate-scroll-shadow-left");
  });

  it("leaves right-pinned cells without a z-index", () => {
    const { style, className } = getCommonPinningStylesAndClassNames(
      fakeColumn("right", 0)
    );
    expect(style.zIndex).toBeUndefined();
    expect(style.right).toBe("0px");
    expect(className).toContain("sticky");
  });

  it("leaves unpinned cells without a z-index", () => {
    const { style, className } = getCommonPinningStylesAndClassNames(
      fakeColumn(false)
    );
    expect(style.zIndex).toBeUndefined();
    expect(className).toContain("relative");
  });

  it("takes only the column", () => {
    expect(getCommonPinningStylesAndClassNames).toHaveLength(1);
  });
});
