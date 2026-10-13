// Keep this allowlist narrow: internal execution/build endpoints are not UI APIs.
export function automationUpstreamPath(pathname: string): string | null {
  if (pathname === "/automation-namespaces") return "/namespaces";
  if (/^\/automations(?:\/[^/]+(?:\/(?:enable|disable))?)?$/.test(pathname)) {
    return pathname;
  }
  return null;
}
