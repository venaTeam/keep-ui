import React from "react";
import { render, screen } from "@testing-library/react";
import {
  AlertSeverityBadge,
  AlertStatusPill,
  isAlertRingingNow,
  normalizeSeverity,
} from "../status-severity-cells";

describe("normalizeSeverity", () => {
  it("maps numeric severities and lower-cases strings", () => {
    expect(normalizeSeverity(5)).toBe("critical");
    expect(normalizeSeverity("5")).toBe("critical");
    expect(normalizeSeverity(1)).toBe("low");
    expect(normalizeSeverity("HIGH")).toBe("high");
  });

  it("returns undefined for empty values", () => {
    expect(normalizeSeverity(undefined)).toBeUndefined();
    expect(normalizeSeverity(null)).toBeUndefined();
    expect(normalizeSeverity("")).toBeUndefined();
    expect(normalizeSeverity("   ")).toBeUndefined();
  });
});

describe("isAlertRingingNow", () => {
  const ringing = { status: "firing", severity: "critical", deleted: false };

  it("is true for a firing critical alert in a noisy preset", () => {
    expect(isAlertRingingNow(ringing, true)).toBe(true);
  });

  it.each([
    ["the preset is not noisy", ringing, false],
    ["the alert is acknowledged", { ...ringing, status: "acknowledged" }, true],
    ["the alert is resolved", { ...ringing, status: "resolved" }, true],
    ["the severity is high", { ...ringing, severity: "high" }, true],
    ["the alert is deleted", { ...ringing, deleted: true }, true],
    ["the status is missing", { severity: "critical" }, true],
  ])("is false when %s", (_label, alert, presetNoisy) => {
    expect(isAlertRingingNow(alert, presetNoisy)).toBe(false);
  });

  it("accepts numeric critical severity and mixed-case status", () => {
    expect(isAlertRingingNow({ status: "firing", severity: 5 }, true)).toBe(true);
    expect(isAlertRingingNow({ status: "firing", severity: "5" }, true)).toBe(
      true
    );
    expect(
      isAlertRingingNow({ status: "FIRING", severity: "Critical" }, true)
    ).toBe(true);
  });

  it("ignores the alert's own isNoisy flag", () => {
    const flagged = { status: "firing", severity: "high", isNoisy: true };
    expect(isAlertRingingNow(flagged, false)).toBe(false);
    expect(isAlertRingingNow(flagged, true)).toBe(false);
  });
});

describe("AlertSeverityBadge", () => {
  it.each([
    ["critical", "Critical"],
    ["high", "High"],
    ["warning", "Warning"],
    ["low", "Low"],
    ["info", "Info"],
    ["error", "Error"],
    [5, "Critical"],
    ["WARNING", "Warning"],
  ])("renders %p as %p", (severity, word) => {
    render(<AlertSeverityBadge severity={severity} />);
    expect(screen.getByTestId("alert-severity-badge")).toHaveTextContent(word);
  });

  it("renders an unknown severity as its raw value in gray", () => {
    render(<AlertSeverityBadge severity="p1-custom" />);
    const badge = screen.getByTestId("alert-severity-badge");
    expect(badge).toHaveTextContent("P1-custom");
    expect(badge).toHaveClass("bg-gray-100");
  });

  it("uses today's palette for known severities", () => {
    render(<AlertSeverityBadge severity="critical" />);
    expect(screen.getByTestId("alert-severity-badge")).toHaveClass(
      "bg-red-100",
      "text-red-800"
    );
  });

  it.each([undefined, "", null])("renders nothing for %p", (severity) => {
    const { container } = render(<AlertSeverityBadge severity={severity} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("AlertStatusPill", () => {
  it.each([
    ["firing", "Firing"],
    ["acknowledged", "Acknowledged"],
    ["resolved", "Resolved"],
    ["suppressed", "Suppressed"],
    ["pending", "Pending"],
    ["merged", "Merged"],
    ["FIRING", "Firing"],
  ])("renders %p as %p", (status, word) => {
    render(<AlertStatusPill status={status} />);
    expect(screen.getByTestId("alert-status-pill")).toHaveTextContent(word);
  });

  it("hides the icon from assistive tech", () => {
    render(<AlertStatusPill status="firing" />);
    const icons = screen
      .getByTestId("alert-status-pill")
      .querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    icons.forEach((icon) => expect(icon).toHaveAttribute("aria-hidden", "true"));
  });

  it("shows the Noisy segment only when noisy", () => {
    const { rerender } = render(<AlertStatusPill status="firing" />);
    expect(screen.queryByTestId("alert-noisy-segment")).not.toBeInTheDocument();

    rerender(<AlertStatusPill status="firing" noisy />);
    expect(screen.getByTestId("alert-noisy-segment")).toHaveTextContent("Noisy");
    expect(screen.getByTestId("alert-status-pill")).toHaveTextContent(
      "FiringNoisy"
    );
  });

  it("renders nothing without a status", () => {
    const { container } = render(<AlertStatusPill status={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
