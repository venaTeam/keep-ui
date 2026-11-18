import { renderHook } from "@testing-library/react";
import { useSyncedAnimation } from "../useSyncedAnimation";

type FakeAnimation = {
  startTime: number | null;
  effect: { target: Element; pseudoElement: string | null };
};

describe("useSyncedAnimation on a pseudo-element", () => {
  it("starts only the element's own pseudo-element animations at the page's time zero", () => {
    const cell = document.createElement("td");
    const child = document.createElement("span");
    const animation = (
      target: Element,
      pseudoElement: string | null
    ): FakeAnimation => ({
      startTime: 812,
      effect: { target, pseudoElement },
    });
    const pulse = animation(cell, "::before");
    const scrollShadow = animation(cell, null);
    const otherPseudo = animation(cell, "::after");
    const descendant = animation(child, "::before");
    const getAnimations = jest.fn(() => [
      pulse,
      scrollShadow,
      otherPseudo,
      descendant,
    ]);
    Object.defineProperty(cell, "getAnimations", { value: getAnimations });
    const { result } = renderHook(() => useSyncedAnimation(true, "::before"));

    result.current(cell);

    expect(getAnimations).toHaveBeenCalledWith({ subtree: true });
    expect(pulse.startTime).toBe(0);
    expect(
      [scrollShadow, otherPseudo, descendant].map((a) => a.startTime)
    ).toEqual([812, 812, 812]);
  });
});
