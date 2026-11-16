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

  it.each<
    [
      string,
      { severity?: unknown; status?: unknown; deleted?: unknown },
      boolean | undefined,
    ]
  >([
    ["the preset is not noisy", critical, false],
    ["the preset's noise is unknown", critical, undefined],
    ["the severity is high", { ...critical, severity: "high" }, true],
    ["the severity is missing", { status: "firing" }, true],
    ["the status is resolved", { ...critical, status: "resolved" }, true],
    [
      "the status is acknowledged",
      { ...critical, status: "acknowledged" },
      true,
    ],
    ["the status is missing", { severity: "critical" }, true],
    ["the alert is deleted", { ...critical, deleted: true }, true],
  ])("stays quiet when %s", (_name, alert, presetNoisy) => {
    expect(isAlertRinging(alert, presetNoisy)).toBe(false);
  });

  it.each<[string, { severity?: unknown; status?: unknown }]>([
    ["a numeric critical severity", { ...critical, severity: 5 }],
    ["a numeric critical severity as a string", { ...critical, severity: "5" }],
    ["the severity in upper case", { ...critical, severity: "CRITICAL" }],
    ["the severity in title case", { ...critical, severity: "Critical" }],
    ["the status in upper case", { ...critical, status: "FIRING" }],
  ])("matches NOISE_BASE_CEL exactly, so stays quiet on %s", (_name, alert) => {
    expect(isAlertRinging(alert, true)).toBe(false);
  });

  it("rings an alert that is explicitly not deleted", () => {
    expect(isAlertRinging({ ...critical, deleted: false }, true)).toBe(true);
  });

  it("stays quiet without an alert", () => {
    expect(isAlertRinging(undefined, true)).toBe(false);
    expect(isAlertRinging(null, true)).toBe(false);
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
