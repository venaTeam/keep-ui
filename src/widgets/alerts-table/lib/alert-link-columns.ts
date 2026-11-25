/** Ids of the alert columns whose URL renders as an icon link. */
export type LinkIconColumnId = "alert_rule_url" | "runbook_url";

/** Default header labels of the icon link columns. */
export const LINK_ICON_COLUMN_LABELS: ReadonlyMap<LinkIconColumnId, string> =
  new Map<LinkIconColumnId, string>([
    ["alert_rule_url", "Rule"],
    ["runbook_url", "Runbook"],
  ]);

/** Whether the column renders its URL as an icon link. */
export function isLinkIconColumn(
  columnId: string
): columnId is LinkIconColumnId {
  return LINK_ICON_COLUMN_LABELS.has(columnId as LinkIconColumnId);
}

/** Whether the URL is a Grafana alert rule link, by an exact `alerting` path segment. */
export function isGrafanaRuleUrl(url: string): boolean {
  try {
    return new URL(url).pathname.split("/").includes("alerting");
  } catch {
    return false;
  }
}
