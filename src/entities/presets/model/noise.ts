const NOISE_BASE = {
  status: "firing",
  deleted: false,
  severity: "critical",
} as const;

/**
 * The CEL condition a noisy preset's alarm sounds on, combined with the
 * preset's own CEL by `PresetsNoise`. Built from the same definition as
 * `matchesNoiseBase`, so the alarm and the ringing rows cannot drift apart.
 * `dismissed` is deliberately absent: a dismissed alert is one whose status
 * is `suppressed`, which `status == 'firing'` already excludes, and the
 * gateway's `dismissed` mapping compares text to boolean and answers 500.
 */
export const NOISE_BASE_CEL = `status == '${NOISE_BASE.status}' && deleted == ${NOISE_BASE.deleted} && severity == '${NOISE_BASE.severity}'`;

/**
 * Whether an alert matches `NOISE_BASE_CEL`, checked in the browser. Exact and
 * case-sensitive, like the alarm: the gateway sends severity and status as
 * the lowercase words of its enums and compares the stored values with `=`.
 * Only `deleted === true` counts as deleted.
 */
export function matchesNoiseBase(
  alert:
    | { severity?: unknown; status?: unknown; deleted?: unknown }
    | null
    | undefined
): boolean {
  return (
    alert?.status === NOISE_BASE.status &&
    (alert.deleted === true) === NOISE_BASE.deleted &&
    alert.severity === NOISE_BASE.severity
  );
}
