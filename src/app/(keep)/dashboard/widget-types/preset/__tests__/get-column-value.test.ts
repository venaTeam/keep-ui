import { getColumnValue } from "../get-column-value";

describe("getColumnValue", () => {
  it("returns the value stored under the exact column key", () => {
    expect(
      getColumnValue(
        { alert_rule_url: "https://rule.example" },
        "alert_rule_url"
      )
    ).toBe("https://rule.example");
  });

  it("reads the camelCase key for a snake_case column the row does not carry", () => {
    expect(
      getColumnValue({ lastReceived: "2026-10-01T10:00:00Z" }, "last_received")
    ).toBe("2026-10-01T10:00:00Z");
  });

  it("prefers the exact key over the camelCase key", () => {
    expect(
      getColumnValue(
        { last_received: "exact", lastReceived: "camel" },
        "last_received"
      )
    ).toBe("exact");
  });

  it("keeps a null value stored under the exact key", () => {
    expect(
      getColumnValue(
        { dismiss_until: null, dismissUntil: "later" },
        "dismiss_until"
      )
    ).toBeNull();
  });

  it("does not apply the camelCase fallback to dotted columns", () => {
    expect(
      getColumnValue(
        { labels: { clusterB: "other label" } },
        "labels.cluster_b"
      )
    ).toBeUndefined();
  });

  it("returns undefined when neither key exists", () => {
    expect(getColumnValue({ name: "alert" }, "last_received")).toBeUndefined();
  });
});
