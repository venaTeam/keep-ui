/**
 * Sandbox for Grafana panel frames. `allow-same-origin` grants the frame its
 * OWN origin (Grafana's), never Keep's, because panels are always
 * cross-origin (see validateGrafanaPanelUrl). `allow-forms` lets Grafana's own
 * forms (e.g. login) submit. Top-navigation stays withheld so a panel cannot
 * redirect the Keep tab.
 */
export const GRAFANA_PANEL_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";

/**
 * Accepts either a panel URL or Grafana's Share > Embed `<iframe src="...">`
 * snippet and returns the URL to frame. The snippet is parsed inertly with
 * DOMParser, which never runs scripts or loads frames.
 */
export function extractGrafanaPanelUrl(input: string): string {
  const value = input.trim();
  if (!value.startsWith("<")) {
    return value;
  }
  const doc = new DOMParser().parseFromString(value, "text/html");
  return doc.querySelector("iframe")?.getAttribute("src")?.trim() ?? "";
}

/**
 * Validates a Grafana panel URL: an allowlisted Grafana origin and a solo
 * panel path (`/d-solo/`, what Grafana's Share > Embed produces), so only
 * single panels are framed rather than arbitrary pages on that host. Keep's
 * own origin is always refused: a same-origin frame with `allow-scripts` and
 * `allow-same-origin` could remove its own sandbox. The URL must spell out
 * `scheme://`, because forms like `https:host/x` parse as absolute here but
 * resolve as a path on Keep's origin when used as an iframe src. Returns an
 * error message or null.
 */
export function validateGrafanaPanelUrl(
  url: string,
  allowedOrigins: readonly string[],
  appOrigin: string
): string | null {
  const value = url.trim();
  if (!value) {
    return "Grafana panel URL is required";
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "Enter a valid URL";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only http(s) URLs can be embedded";
  }
  if (!/^https?:\/\//i.test(value)) {
    return "Enter a full URL starting with http:// or https://";
  }
  if (!appOrigin || parsed.origin === appOrigin) {
    return "Keep itself cannot be embedded";
  }
  if (allowedOrigins.length === 0) {
    return "Grafana panels are not enabled on this Keep instance";
  }
  if (!allowedOrigins.includes(parsed.origin)) {
    return `${parsed.origin} is not an allowed Grafana. Allowed: ${allowedOrigins.join(", ")}`;
  }
  if (!parsed.pathname.includes("/d-solo/")) {
    return "Use a single panel's embed URL (Grafana: panel menu > Share > Embed), which contains /d-solo/";
  }
  return null;
}
