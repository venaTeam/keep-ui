import {
  isGrafanaRuleUrl,
  isLinkIconColumn,
  LINK_ICON_COLUMN_LABELS,
} from "@/widgets/alerts-table/lib/alert-link-columns";

describe("isGrafanaRuleUrl", () => {
  it.each([
    "https://grafana-olly.com/alerting/grafana/aef3k2pq/view?orgId=1",
    "https://grafana-olly.com/alerting/P1809F7CD0C75ACF3/HighCPU/view",
    "https://grafana-olly.com/alerting/list?search=HighCPU",
    "https://grafana-olly.com/grafana/alerting/grafana/aef3k2pq/view",
  ])("is true for %s", (url) => {
    expect(isGrafanaRuleUrl(url)).toBe(true);
  });

  it.each([
    "http://prometheus.ops.internal/alerts?search=PodCrashLooping",
    "https://x.com/alertingx/1",
    "https://x.com/my-alerting/1",
    "not a url",
  ])("is false for %s", (url) => {
    expect(isGrafanaRuleUrl(url)).toBe(false);
  });
});

describe("isLinkIconColumn", () => {
  it.each(["alert_rule_url", "runbook_url"])("is true for %s", (id) => {
    expect(isLinkIconColumn(id)).toBe(true);
  });

  it.each(["url", "generatorURL"])("is false for %s", (id) => {
    expect(isLinkIconColumn(id)).toBe(false);
  });
});

describe("LINK_ICON_COLUMN_LABELS", () => {
  it("labels the rule and runbook columns", () => {
    expect(LINK_ICON_COLUMN_LABELS.get("alert_rule_url")).toBe("Rule");
    expect(LINK_ICON_COLUMN_LABELS.get("runbook_url")).toBe("Runbook");
  });
});
