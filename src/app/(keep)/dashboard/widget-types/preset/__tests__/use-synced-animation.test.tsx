import { renderHook } from "@testing-library/react";
import { useSyncedAnimation } from "../use-synced-animation";

const elementWith = (animations: Array<{ startTime: number | null }>) => {
  const element = document.createElement("div");
  Object.defineProperty(element, "getAnimations", {
    value: () => animations,
  });
  return element;
};

describe("useSyncedAnimation", () => {
  it("starts every animation of the element at the page's time zero", () => {
    const animations = [{ startTime: 812 }, { startTime: null }];
    const { result } = renderHook(() => useSyncedAnimation(true));

    result.current(elementWith(animations));

    expect(animations.map((animation) => animation.startTime)).toEqual([0, 0]);
  });

  it("leaves the animations alone while off", () => {
    const animations = [{ startTime: 812 }];
    const { result } = renderHook(() => useSyncedAnimation(false));

    result.current(elementWith(animations));

    expect(animations[0].startTime).toBe(812);
  });

  it("gives a new callback when it turns on, so React runs it again", () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useSyncedAnimation(enabled),
      { initialProps: { enabled: false } }
    );
    const off = result.current;

    rerender({ enabled: true });

    expect(result.current).not.toBe(off);
  });

  it("ignores a detached ref and a browser without getAnimations", () => {
    const { result } = renderHook(() => useSyncedAnimation(true));

    expect(() => result.current(null)).not.toThrow();
    expect(() => result.current(document.createElement("div"))).not.toThrow();
  });
});
