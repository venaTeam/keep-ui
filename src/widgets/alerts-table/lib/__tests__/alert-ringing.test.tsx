import React from "react";
import { render, renderHook } from "@testing-library/react";
import {
  RINGING_REASON,
  isAlertRinging,
  useRingingRows,
} from "../alert-ringing";

const critical = { severity: "critical", status: "firing" };

describe("isAlertRinging", () => {
  it("rings a critical firing alert in a noisy preset", () => {
    expect(isAlertRinging(critical, true)).toBe(true);
  });

  it.each([false, undefined])(
    "stays quiet when the preset's noisy flag is %s",
    (presetNoisy) => {
      expect(isAlertRinging(critical, presetNoisy)).toBe(false);
    }
  );

  it("stays quiet in a noisy preset when the alert does not match the alarm's condition", () => {
    expect(isAlertRinging({ ...critical, deleted: true }, true)).toBe(false);
    expect(isAlertRinging({ ...critical, severity: "high" }, true)).toBe(false);
    expect(isAlertRinging(undefined, true)).toBe(false);
  });
});

const OVERLAY = [
  "isolate",
  "[&:not(.sticky)]:relative",
  "before:pointer-events-none",
  "before:absolute",
  "before:inset-0",
  "before:-z-10",
  "before:border-y-2",
  "before:border-[color:var(--blink-row-edge)]",
  "before:bg-[color:var(--blink-row-tint)]",
  "motion-safe:before:animate-ringing-pulse",
];

const ringingRowOf = (presetNoisy: boolean) =>
  renderHook(() => useRingingRows(presetNoisy)).result.current;

describe("useRingingRows", () => {
  it("leaves a quiet row as it was", () => {
    const row = ringingRowOf(true)({ ...critical, status: "resolved" });

    expect(row.rowProps).toEqual({});
    expect(row.cellProps(0, 3)).toEqual({});
    expect(row.reason).toBeNull();
  });

  it("marks a ringing row and puts the pulse on an overlay behind each cell's content", () => {
    const row = ringingRowOf(true)(critical);
    const classes = (index: number) =>
      row.cellProps(index, 3).className!.split(" ");

    expect(row.rowProps).toEqual({ "data-ringing": "true" });
    [0, 1, 2].forEach((index) =>
      expect(classes(index)).toEqual(expect.arrayContaining(OVERLAY))
    );
    expect(
      [0, 1, 2].flatMap((index) =>
        classes(index).filter((name) => /bg-inherit|^!|^bg-/.test(name))
      )
    ).toEqual([]);
  });

  it("turns the tint off while the table row is hovered, selected or drag-selected, keeping the red edge", () => {
    const classes = ringingRowOf(true)(critical)
      .cellProps(1, 3)
      .className!.split(" ");

    expect(classes).toEqual(
      expect.arrayContaining([
        "[tr.group:hover>&]:before:bg-transparent",
        "[tr[data-selection]>&]:before:bg-transparent",
        "before:border-[color:var(--blink-row-edge)]",
      ])
    );
    expect(
      classes.filter((name) => name.includes("border-transparent"))
    ).toEqual([]);
  });

  it("draws one edge between adjacent ringing rows, on the upper row", () => {
    const row = ringingRowOf(true)(critical);
    const classes = (belowRingingRow?: boolean) =>
      row.cellProps(1, 3, belowRingingRow).className!.split(" ");

    expect(classes()).toEqual(
      expect.arrayContaining([
        "before:border-y-2",
        "[tr[data-ringing]+tr[data-ringing]>&]:before:border-t-0",
      ])
    );
    expect(classes()).not.toContain("before:border-t-0");
    expect(classes(false)).not.toContain("before:border-t-0");
    expect(classes(true)).toContain("before:border-t-0");
  });

  it("closes the overlay's red edge at the first and the last cell", () => {
    const row = ringingRowOf(true)(critical);
    const edges = (index: number) =>
      row
        .cellProps(index, 3)
        .className!.split(" ")
        .filter((name) => /^before:border-[lr]-2$/.test(name));

    expect(edges(0)).toEqual(["before:border-l-2"]);
    expect(edges(1)).toEqual([]);
    expect(edges(2)).toEqual(["before:border-r-2"]);
    expect(ringingRowOf(true)(critical).cellProps(0, 1).className).toContain(
      "before:border-r-2"
    );
  });

  it("gives every ringing cell the row colors and the sync ref", () => {
    const { style, ref } = ringingRowOf(true)(critical).cellProps(1, 3);
    const vars = style as Record<string, string>;

    expect(vars["--blink-row-tint"]).toMatch(/^rgb\(/);
    expect(vars["--blink-row-edge"]).toMatch(/^#/);
    expect(typeof ref).toBe("function");
  });

  it("rings a row for a list of alerts when any of them rings", () => {
    const ringingRow = ringingRowOf(true);

    expect(
      ringingRow([{ ...critical, severity: "high" }, critical]).rowProps
    ).toEqual({ "data-ringing": "true" });
    expect(ringingRow([{ ...critical, severity: "high" }]).rowProps).toEqual(
      {}
    );
    expect(ringingRow([]).rowProps).toEqual({});
  });

  it.each([false, undefined])(
    "rings nothing when the preset's noisy flag is %s",
    (presetNoisy) => {
      const row = renderHook(() =>
        useRingingRows(presetNoisy as boolean)
      ).result.current(critical);

      expect(row.rowProps).toEqual({});
      expect(row.reason).toBeNull();
    }
  );

  it("states the reason as visually hidden text", () => {
    const { getByText } = render(<>{ringingRowOf(true)(critical).reason}</>);

    expect(RINGING_REASON).toBe("Ringing: critical, firing, noisy preset");
    expect(getByText(RINGING_REASON)).toHaveClass("sr-only", "select-none");
  });
});
