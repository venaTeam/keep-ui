/**
 * The CEL condition a noisy preset's alarm sounds on, combined with the
 * preset's own CEL by `PresetsNoise`. `dismissed` is deliberately absent: a
 * dismissed alert is one whose status is `suppressed`, which
 * `status == 'firing'` already excludes, and the gateway's `dismissed`
 * mapping compares text to boolean and answers 500. `isAlertRinging`
 * (`widgets/alerts-table/lib/alert-ringing.tsx`) mirrors this condition in
 * JS for the ringing rows, and its tests pin this exact string: a change here
 * needs the same change there.
 */
export const NOISE_BASE_CEL =
  "status == 'firing' && deleted == false && severity == 'critical'";
