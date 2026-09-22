/**
 * Shared CEL builders — pure functions used by specs and page objects across
 * more than one feature (alerts feed + incident preset-grouping), so they live
 * in the cross-page `components` bucket rather than inside a single page file.
 */

/** CEL for a single alert by fingerprint. */
export const celFingerprint = (fp: string) => `fingerprint == "${fp}"`;

/** CEL matching a set of fingerprints (e.g. the bulk group). */
export const celFingerprintIn = (fps: string[]) =>
  fps.map((fp) => `fingerprint == "${fp}"`).join(" || ");
