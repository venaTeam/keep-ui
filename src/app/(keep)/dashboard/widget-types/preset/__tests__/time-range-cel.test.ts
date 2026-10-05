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
});
