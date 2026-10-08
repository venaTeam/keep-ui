// Returns the value as a normalized ISO timestamp, or null if it is not a
// parseable date. Re-serializing (rather than interpolating the raw value)
// keeps anything else in the URL param out of the CEL string.
function toIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// The gateway's CEL field mapping is snake_case only (`last_received`); the
// camelCase `lastReceived` is the DTO alias and is rejected as an unknown field.
// The param comes straight from the URL, so a malformed value yields no filter
// instead of throwing during render.
export function buildTimeRangeCel(timeRangeSearchParam: string | null): string {
  if (!timeRangeSearchParam) {
    return "";
  }

  let parsedTimeRange: { start?: unknown; end?: unknown } | null;
  try {
    parsedTimeRange = JSON.parse(timeRangeSearchParam);
  } catch {
    return "";
  }

  const start = toIsoTimestamp(parsedTimeRange?.start);
  const end = toIsoTimestamp(parsedTimeRange?.end);
  if (!start || !end) {
    return "";
  }

  return `last_received >= "${start}" && last_received <= "${end}"`;
}
