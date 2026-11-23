import { COUNT_BY_ALERT_FIELD_OPTIONS } from "@/entities/presets/model/count-by";
import {
  COMMON_ENRICHMENT_FIELDS,
  GROUPABLE_ALERT_FIELDS,
  GROUP_BY_SHORTLIST,
  getAlertColumnOptions,
  getColumnLabel,
  getGroupByFieldOptions,
  matchesSearch,
} from "../alert-column-options";

describe("getAlertColumnOptions", () => {
  it("options merge table columns and extra fields without excluded ids", () =>
    expect(
      getAlertColumnOptions(
        ["name", "checkbox", "service"],
        ["labels.team", "service"]
      )
    ).toEqual(["labels.team", "name", "service"]));

  it("drops the menu and noise columns too", () =>
    expect(
      getAlertColumnOptions(["alertMenu", "noise", "status"], ["noise"])
    ).toEqual(["status"]));

  it("returns an empty list when there is nothing to offer", () =>
    expect(getAlertColumnOptions([], [])).toEqual([]));
});

describe("GROUPABLE_ALERT_FIELDS", () => {
  it("lists the alert fields worth grouping by besides the shortlist", () =>
    expect(GROUPABLE_ALERT_FIELDS).toEqual([
      "environment",
      "component",
      "object",
      "impact",
      "group",
      "providerId",
      "ticket_status",
      "ticket_type",
      "dismiss_mode",
    ]));

  it("repeats no shortlist field", () =>
    GROUP_BY_SHORTLIST.forEach((option) =>
      expect(GROUPABLE_ALERT_FIELDS).not.toContain(option.value)
    ));
});

describe("getGroupByFieldOptions", () => {
  it("joins the groupable alert fields and the given columns, de-duplicated, without row chrome, sorted", () =>
    expect(
      getGroupByFieldOptions(["labels.team", "environment", "checkbox", "name"])
    ).toEqual([
      "component",
      "dismiss_mode",
      "environment",
      "group",
      "impact",
      "labels.team",
      "name",
      "object",
      "providerId",
      "ticket_status",
      "ticket_type",
    ]));

  it("is the groupable alert fields alone when the widget has no columns", () =>
    expect(getGroupByFieldOptions([])).toEqual(
      [...GROUPABLE_ALERT_FIELDS].sort((first, second) =>
        first.localeCompare(second)
      )
    ));
});

describe("getColumnLabel", () => {
  it("labels prefer the rename, then startCase", () => {
    expect(getColumnLabel("node_name")).toBe("Node Name");
    expect(getColumnLabel("node_name", { node_name: "Server" })).toBe("Server");
    expect(getColumnLabel("labels.team")).toBe("Labels Team");
  });

  it("gives node_name and host different labels", () => {
    expect(getColumnLabel("node_name")).toBe("Node Name");
    expect(getColumnLabel("host")).toBe("Host");
  });

  it("keeps \"Alert name\" for the name column", () =>
    expect(getColumnLabel("name")).toBe("Alert name"));

  it("ignores an empty rename", () =>
    expect(getColumnLabel("service", { service: "" })).toBe("Service"));

  it("ignores inherited keys of the rename mapping", () =>
    expect(getColumnLabel("constructor", {})).toBe("Constructor"));
});

describe("GROUP_BY_SHORTLIST", () => {
  it("is Incident, the Count field options in their order, then Source and Status", () =>
    expect(GROUP_BY_SHORTLIST).toEqual([
      { value: "incident", label: "Incident" },
      ...COUNT_BY_ALERT_FIELD_OPTIONS,
      { value: "source", label: "Source" },
      { value: "status", label: "Status" },
    ]));

  it("reads Incident, Alert name, Service, Host, Application, Site, Assignee, Source, Status", () =>
    expect(GROUP_BY_SHORTLIST.map((option) => option.label)).toEqual([
      "Incident",
      "Alert name",
      "Service",
      "Host",
      "Application",
      "Site",
      "Assignee",
      "Source",
      "Status",
    ]));

  it("has no severity", () =>
    expect(GROUP_BY_SHORTLIST.map((option) => option.value)).not.toContain(
      "severity"
    ));

  it("follows the Count options; column labels keep their names", () => {
    jest.isolateModules(() => {
      jest.doMock("@/entities/presets/model/count-by", () => ({
        COUNT_BY_ALERT_FIELD_OPTIONS: [{ value: "site", label: "Location" }],
      }));
      const isolated = require("../alert-column-options");
      expect(isolated.GROUP_BY_SHORTLIST).toEqual([
        { value: "incident", label: "Incident" },
        { value: "site", label: "Location" },
        { value: "source", label: "Source" },
        { value: "status", label: "Status" },
      ]);
      expect(isolated.getColumnLabel("site")).toBe("Site");
    });
    jest.dontMock("@/entities/presets/model/count-by");
  });
});

describe("COMMON_ENRICHMENT_FIELDS", () => {
  it("keeps the presets page's list unchanged", () =>
    expect(COMMON_ENRICHMENT_FIELDS).toEqual([
      "ticket_id",
      "ticket_url",
      "ticket_type",
      "ticket_status",
      "environment",
      "service",
      "region",
      "cluster",
      "namespace",
      "pod",
      "container",
      "host",
      "instance",
      "application",
      "component",
      "object",
      "site",
      "impact",
      "team",
      "owner",
      "runbook_url",
      "alert_rule_url",
      "dashboard_url",
      "logs_url",
      "metrics_url",
      "impacted_customer_name",
      "severity_override",
      "priority",
      "escalation_policy",
      "on_call_engineer",
      "alert_enrichment",
    ]));
});

describe("matchesSearch", () => {
  it("matches a case-insensitive substring", () => {
    expect(matchesSearch("labels.Team", "team")).toBe(true);
    expect(matchesSearch("Service", "SERV")).toBe(true);
  });

  it("matches everything for an empty query and nothing it does not contain", () => {
    expect(matchesSearch("service", "")).toBe(true);
    expect(matchesSearch("service", "host")).toBe(false);
  });
});
