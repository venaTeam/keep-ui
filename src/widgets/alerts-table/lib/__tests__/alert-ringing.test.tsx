import React from "react";
import { render } from "@testing-library/react";
import {
  RINGING_CELL_CLASS_NAME,
  RINGING_REASON,
  RingingReason,
  getRingingProps,
  isAlertRinging,
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

describe("getRingingProps", () => {
  it("adds nothing to a quiet row", () => {
    expect(getRingingProps(false)).toEqual({});
  });

  it("gives a ringing row the pulse, its red and a data attribute", () => {
    const { className, style, ...attributes } = getRingingProps(true);
    const vars = style as Record<string, string>;

    expect(className).toContain("motion-safe:animate-missing-blink");
    expect(attributes).toEqual({ "data-ringing": "true" });
    expect(vars["--blink-strong"]).toMatch(/^#f/);
    expect(vars["--blink-soft"]).toMatch(/^#f/);
  });

  it("swaps the pulse for a steady light tint under reduced motion", () => {
    const classes = getRingingProps(true).className!.split(" ");

    expect(classes).toEqual(
      expect.arrayContaining([
        "motion-safe:animate-missing-blink",
        "motion-reduce:bg-[color:var(--blink-soft)]",
        "motion-reduce:text-[color:var(--blink-soft-text)]",
      ])
    );
    expect(classes.filter((name) => !name.startsWith("motion-"))).toEqual([]);
  });

  it("lets a ringing row's cells paint the row's pulse", () => {
    expect(RINGING_CELL_CLASS_NAME).toBe("!bg-inherit");
  });
});

describe("RingingReason", () => {
  it("states the reason as visually hidden text", () => {
    const { getByText } = render(<RingingReason />);

    expect(RINGING_REASON).toBe("Ringing: critical, firing, noisy preset");
    expect(getByText(RINGING_REASON)).toHaveClass("sr-only");
  });
});
