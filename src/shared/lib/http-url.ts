/**
 * True only for absolute http(s) URLs. Anything stored or ingested must pass
 * this before it reaches `window.open` or an `href`, so `javascript:` and
 * `data:` URLs never run in the app's origin.
 */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
