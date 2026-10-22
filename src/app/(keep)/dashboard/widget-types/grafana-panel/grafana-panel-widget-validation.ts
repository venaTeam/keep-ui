/**
 * Sandbox for Grafana panel frames. `allow-same-origin` grants the frame its
 * OWN origin (Grafana's), never Keep's, because panels are always
 * cross-origin (see validateGrafanaPanelUrl). `allow-forms` lets Grafana's own
 * forms (e.g. login) submit; a login inside the frame still needs Grafana's
 * session cookie to be sent cross-site (`cookie_samesite = none`), and SSO
 * providers usually refuse to be framed. Top-navigation stays withheld so a
 * panel cannot redirect the Keep tab.
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
 * Validates a Grafana panel URL: an allowlisted Grafana origin and a path
 * starting with `/d-solo/` (what Grafana's Share > Embed produces), so only
 * single panels are framed rather than arbitrary pages on that host. Keep's
 * own origin is always refused: a same-origin frame with `allow-scripts` and
 * `allow-same-origin` could remove its own sandbox. The URL must spell out
 * `scheme://`, because forms like `https:host/x` parse as absolute here but
 * resolve as a path on Keep's origin when used as an iframe src. Credentials
 * in the URL are refused because the URL is stored in the dashboard, and an
 * http panel is refused when Keep is served over https, where browsers block
 * it as mixed content. Returns an error message or null.
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
  if (parsed.username || parsed.password) {
    return "Remove the username and password from the URL";
  }
  if (parsed.protocol === "http:" && appOrigin.startsWith("https:")) {
    return "Keep is served over https, so browsers block http:// panels. Use Grafana's https URL";
  }
  if (!parsed.pathname.startsWith("/d-solo/")) {
    return "Use a single panel's embed URL (Grafana: panel menu > Share > Embed), which starts with /d-solo/";
  }
  return null;
}
