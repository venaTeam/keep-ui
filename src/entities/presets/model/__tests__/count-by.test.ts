import {
  COUNT_BY_ALERT_FIELD_OPTIONS,
  CountBy,
  DEFAULT_INCIDENT_STATUS,
  INCIDENT_STATUS_OPTIONS,
  getCountMode,
  getCountUnitLabel,
} from "../count-by";

describe("getCountMode", () => {
  it("treats a missing countBy as counting alerts", () => {
    expect(getCountMode(undefined)).toBe("alerts");
  });

  it("maps the incident field to incidents", () => {
    expect(getCountMode({ field: "incident", incidentStatus: "active" })).toBe(
      "incidents"
    );
  });

  it.each(["name", "service", "node_name", "application", "site", "assignee"])(
    "maps %s to the other-field mode",
    (field) => {
      expect(getCountMode({ field } as CountBy)).toBe("field");
    }
  );
});

describe("getCountUnitLabel", () => {
  it.each<[CountBy, number, string]>([
    [{ field: "incident", incidentStatus: "active" }, 3, "Active incidents"],
    [{ field: "incident", incidentStatus: "active" }, 1, "Active incident"],
    [{ field: "incident", incidentStatus: "firing" }, 12, "Firing incidents"],
    [{ field: "incident", incidentStatus: "firing" }, 1, "Firing incident"],
    [
      { field: "incident", incidentStatus: "acknowledged" },
      2,
      "Acknowledged incidents",
    ],
    [{ field: "incident" }, 0, "Active incidents"],
    [{ field: "name" }, 2, "Alert names"],
    [{ field: "name" }, 1, "Alert name"],
    [{ field: "service" }, 5, "Services"],
    [{ field: "service" }, 1, "Service"],
    [{ field: "node_name" }, 4, "Hosts"],
    [{ field: "application" }, 4, "Applications"],
    [{ field: "site" }, 0, "Sites"],
    [{ field: "assignee" }, 2, "Assignees"],
    [{ field: "assignee" }, 1, "Assignee"],
  ])("labels %j with count %d as %s", (countBy, count, expected) => {
    expect(getCountUnitLabel(countBy, count)).toBe(expected);
  });
});

describe("option lists", () => {
  it("offers the other fields in the order shown in the form", () => {
    expect(COUNT_BY_ALERT_FIELD_OPTIONS).toEqual([
      { value: "name", label: "Alert name" },
      { value: "service", label: "Service" },
      { value: "node_name", label: "Host" },
      { value: "application", label: "Application" },
      { value: "site", label: "Site" },
      { value: "assignee", label: "Assignee" },
    ]);
  });

  it("offers the three incident statuses with active first", () => {
    expect(INCIDENT_STATUS_OPTIONS.map((option) => option.value)).toEqual([
      "active",
      "firing",
      "acknowledged",
    ]);
    expect(DEFAULT_INCIDENT_STATUS).toBe("active");
  });
});
