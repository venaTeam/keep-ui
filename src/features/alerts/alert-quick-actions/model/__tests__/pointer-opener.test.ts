import type { MouseEvent } from "react";
import { getPointerOpener, releasePointerOpener } from "../pointer-opener";

const click = (
  button: HTMLElement,
  detail: number,
  pointerType?: string
): MouseEvent<HTMLElement> =>
  ({
    detail,
    currentTarget: button,
    nativeEvent: pointerType === undefined ? {} : { pointerType },
  }) as unknown as MouseEvent<HTMLElement>;

describe("getPointerOpener", () => {
  const button = document.createElement("button");

  it("returns the button for a mouse click", () => {
    expect(getPointerOpener(click(button, 1, "mouse"))).toBe(button);
  });

  it("returns the button when the browser reports no pointer type", () => {
    expect(getPointerOpener(click(button, 1))).toBe(button);
  });

  it("returns null for a keyboard press, which has no click count", () => {
    expect(getPointerOpener(click(button, 0))).toBeNull();
  });

  it("returns null for a click that no pointer made", () => {
    expect(getPointerOpener(click(button, 1, ""))).toBeNull();
  });
});

describe("releasePointerOpener", () => {
  let opener: HTMLButtonElement;
  let other: HTMLButtonElement;

  beforeEach(() => {
    jest.useFakeTimers();
    opener = document.createElement("button");
    other = document.createElement("button");
    document.body.append(opener, other);
  });

  afterEach(() => {
    opener.remove();
    other.remove();
    jest.useRealTimers();
  });

  it("takes focus off the opener once the dialog has handed it back", () => {
    releasePointerOpener(opener);
    opener.focus();

    expect(document.activeElement).toBe(opener);

    jest.runOnlyPendingTimers();

    expect(document.activeElement).toBe(document.body);
  });

  it("leaves focus that moved elsewhere", () => {
    releasePointerOpener(opener);
    other.focus();

    jest.runOnlyPendingTimers();

    expect(document.activeElement).toBe(other);
  });

  it("does nothing without an opener", () => {
    releasePointerOpener(null);

    expect(jest.getTimerCount()).toBe(0);
  });
});
