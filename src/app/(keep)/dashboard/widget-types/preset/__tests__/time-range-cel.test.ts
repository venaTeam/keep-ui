import { buildTimeRangeCel } from "../time-range-cel";

describe("buildTimeRangeCel", () => {
  it("returns an empty filter when no time range is selected", () => {
    expect(buildTimeRangeCel(null)).toBe("");
    expect(buildTimeRangeCel("")).toBe("");
  });

  it("filters on the snake_case last_received field the gateway maps", () => {
    const cel = buildTimeRangeCel(
      JSON.stringify({
        start: "2026-10-01T00:00:00.000Z",
        end: "2026-10-02T00:00:00.000Z",
      })
    );

    expect(cel).toBe(
      'last_received >= "2026-10-01T00:00:00.000Z" && last_received <= "2026-10-02T00:00:00.000Z"'
    );
    expect(cel).not.toContain("lastReceived");
  });

  it("returns an empty filter for a malformed param instead of throwing", () => {
    expect(buildTimeRangeCel("not json")).toBe("");
    expect(buildTimeRangeCel("null")).toBe("");
    expect(buildTimeRangeCel(JSON.stringify({ start: "2026-10-01" }))).toBe("");
    expect(
      buildTimeRangeCel(JSON.stringify({ start: "nope", end: "nope" }))
    ).toBe("");
  });

  it("does not let the param inject CEL", () => {
    const cel = buildTimeRangeCel(
      JSON.stringify({
        start: '2026-10-01T00:00:00.000Z" || true || "',
        end: "2026-10-02T00:00:00.000Z",
      })
    );

    expect(cel).toBe("");
  });

  it("normalizes parseable dates to ISO timestamps", () => {
    const cel = buildTimeRangeCel(
      JSON.stringify({
        start: "2026-10-01T02:00:00+02:00",
        end: "2026-10-02T00:00:00Z",
      })
    );

    expect(cel).toBe(
      'last_received >= "2026-10-01T00:00:00.000Z" && last_received <= "2026-10-02T00:00:00.000Z"'
    );
  });
});
