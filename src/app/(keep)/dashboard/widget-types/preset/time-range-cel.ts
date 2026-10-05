// The gateway's CEL field mapping is snake_case only (`last_received`); the
// camelCase `lastReceived` is the DTO alias and is rejected as an unknown field.
export function buildTimeRangeCel(timeRangeSearchParam: string | null): string {
  if (!timeRangeSearchParam) {
    return "";
  }
  const parsedTimeRange = JSON.parse(timeRangeSearchParam);
  return `last_received >= "${parsedTimeRange.start}" && last_received <= "${parsedTimeRange.end}"`;
}
