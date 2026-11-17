import { NOISE_BASE_CEL, matchesNoiseBase } from "../noise";

const critical = { severity: "critical", status: "firing" };

describe("NOISE_BASE_CEL", () => {
  it("is exactly the CEL the alarm queries /alerts/query/count with", () => {
    expect(NOISE_BASE_CEL).toBe(
      "status == 'firing' && deleted == false && severity == 'critical'"
    );
  });
});

describe("matchesNoiseBase", () => {
  it.each<
    [string, { severity?: unknown; status?: unknown; deleted?: unknown }]
  >([
    ["deleted is absent", critical],
    ["deleted is false", { ...critical, deleted: false }],
  ])("matches a critical firing alert when %s", (_name, alert) => {
    expect(matchesNoiseBase(alert)).toBe(true);
  });

  it.each<
    [string, { severity?: unknown; status?: unknown; deleted?: unknown }]
  >([
    ["the alert is deleted", { ...critical, deleted: true }],
    ["the severity is high", { ...critical, severity: "high" }],
    ["the severity is missing", { status: "firing" }],
    ["the status is resolved", { ...critical, status: "resolved" }],
    ["the status is acknowledged", { ...critical, status: "acknowledged" }],
    ["the status is missing", { severity: "critical" }],
    [
      "the severity is the numeric critical value",
      { ...critical, severity: 5 },
    ],
    ["the severity is that number as a string", { ...critical, severity: "5" }],
    ["the severity is in upper case", { ...critical, severity: "CRITICAL" }],
    ["the severity is in title case", { ...critical, severity: "Critical" }],
    ["the status is in upper case", { ...critical, status: "FIRING" }],
  ])("does not match when %s", (_name, alert) => {
    expect(matchesNoiseBase(alert)).toBe(false);
  });

  it("does not match without an alert", () => {
    expect(matchesNoiseBase(undefined)).toBe(false);
    expect(matchesNoiseBase(null)).toBe(false);
  });
});
