/**
 * A dismissal deadline as epoch ms. The gateway sends ISO 8601; a value without
 * a timezone (some databases return one) is UTC, not the browser's local time.
 *
 * Kept free of React so server components (via lib/utils) can use it too.
 */
export function parseDeadline(value: string): number {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
  return Date.parse(hasZone ? value : `${value}Z`);
}
