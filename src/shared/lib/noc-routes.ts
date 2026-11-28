/*
 * Where a NOC user may go. The middleware sends them from any other page to
 * the feed; the assistant's links to pages outside these are refused by the
 * gateway (`noc_allowed` in its navigation vectors) for the same reason.
 */

export const NOC_ROLE = "noc";
export const NOC_HOME_PATH = "/alerts/feed";

/** Whether a NOC user may open this path: the alerts pages only. */
export function isNocAllowedPath(pathname: string): boolean {
  return pathname.startsWith("/alerts");
}

/** Where the middleware sends this user instead, or null to let them through. */
export function getNocRedirect(role: unknown, pathname: string): string | null {
  return role === NOC_ROLE && !isNocAllowedPath(pathname)
    ? NOC_HOME_PATH
    : null;
}
