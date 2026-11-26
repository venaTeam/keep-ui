import { formatQuery, RuleGroupType } from "react-querybuilder";
import { buildCorrelationRuleBody } from "../correlation-rule-body";
import { CorrelationFormType } from "../types";

// Characterization: the body the correlation sidebar sends to POST /rules
// (create) and PUT /rules/{id} (edit) must not change when it moves into a
// function. `legacyBody` is the inline code of CorrelationSidebarBody's
// submit handler before the move, copied verbatim.
function legacyBody(
  correlationFormData: CorrelationFormType,
  timeframeInSeconds: number,
  totalAlertsFound: number
) {
  const {
    name,
    query,
    timeUnit,
    description,
    groupedAttributes,
    requireApprove,
    resolveOn,
    createOn,
    incidentNameTemplate,
    incidentPrefix,
    multiLevel,
    multiLevelPropertyName,
    threshold,
    assignee,
  } = correlationFormData;

  return {
    sqlQuery: formatQuery(query, "parameterized_named"),
    groupDescription: description,
    ruleName: name,
    celQuery: formatQuery(query, "cel"),
    timeframeInSeconds,
    timeUnit: timeUnit,
    groupingCriteria: totalAlertsFound ? groupedAttributes : [],
    requireApprove: requireApprove,
    resolveOn: resolveOn,
    createOn: createOn,
    incidentNameTemplate,
    incidentPrefix,
    multiLevel,
    multiLevelPropertyName,
    threshold,
    assignee,
  };
}

const QUERY: RuleGroupType = {
  combinator: "or",
  rules: [
    {
      combinator: "and",
      rules: [
        { field: "source", operator: "=", value: "grafana" },
        { field: "severity", operator: "in", value: "critical,high" },
      ],
    },
    {
      combinator: "and",
      rules: [{ field: "labels.team", operator: "=", value: "5" }],
    },
  ],
};

// What a new rule looks like after filling in the empty form.
const CREATE_FORM: CorrelationFormType = {
  name: "DB storms",
  description: "",
  timeAmount: 24,
  timeUnit: "hours",
  groupedAttributes: ["labels.service"],
  requireApprove: false,
  resolveOn: "never",
  createOn: "any",
  incidentNameTemplate: "",
  incidentPrefix: "",
  multiLevel: false,
  multiLevelPropertyName: "",
  threshold: 1,
  assignee: undefined,
  query: QUERY,
};

// What the sidebar builds from an existing rule (CorrelationSidebar/index.tsx),
// including the `incidents` field the body leaves out.
const EDIT_FORM = {
  name: "Payments",
  description: "Payments incidents",
  timeAmount: 30,
  timeUnit: "minutes",
  groupedAttributes: ["labels.region", "service"],
  requireApprove: true,
  resolveOn: "all",
  createOn: "all",
  query: QUERY,
  incidents: 4,
  incidentNameTemplate: "{{ alert.service }} down",
  incidentPrefix: "PAY",
  multiLevel: true,
  multiLevelPropertyName: "labels.host",
  threshold: 3,
  assignee: "someone@example.com",
} as CorrelationFormType;

describe("buildCorrelationRuleBody", () => {
  it("builds a create body like before", () => {
    const body = buildCorrelationRuleBody(CREATE_FORM, {
      timeframeInSeconds: 86400,
      alertsFound: 12,
    });
    expect(body).toEqual(legacyBody(CREATE_FORM, 86400, 12));
    expect(body).toEqual({
      sqlQuery: {
        sql: "((source = :source_1 and severity in (:severity_1, :severity_2)) or (labels.team = :labels.team_1))",
        params: {
          source_1: "grafana",
          severity_1: "critical",
          severity_2: "high",
          "labels.team_1": "5",
        },
      },
      groupDescription: "",
      ruleName: "DB storms",
      celQuery:
        '(source == "grafana" && severity in ["critical", "high"]) || (labels.team == "5")',
      timeframeInSeconds: 86400,
      timeUnit: "hours",
      groupingCriteria: ["labels.service"],
      requireApprove: false,
      resolveOn: "never",
      createOn: "any",
      incidentNameTemplate: "",
      incidentPrefix: "",
      multiLevel: false,
      multiLevelPropertyName: "",
      threshold: 1,
      assignee: undefined,
    });
    expect(Object.keys(body)).toEqual(
      Object.keys(legacyBody(CREATE_FORM, 86400, 12))
    );
  });

  it("builds an edit body like before and leaves out form-only fields", () => {
    const body = buildCorrelationRuleBody(EDIT_FORM, {
      timeframeInSeconds: 1800,
      alertsFound: 1,
    });
    expect(body).toEqual(legacyBody(EDIT_FORM, 1800, 1));
    expect(body).not.toHaveProperty("incidents");
    expect(body).toMatchObject({
      timeframeInSeconds: 1800,
      timeUnit: "minutes",
      multiLevel: true,
      multiLevelPropertyName: "labels.host",
      threshold: 3,
      incidentNameTemplate: "{{ alert.service }} down",
      incidentPrefix: "PAY",
      assignee: "someone@example.com",
    });
  });

  it("sends the description as groupDescription", () => {
    const body = buildCorrelationRuleBody(EDIT_FORM, {
      timeframeInSeconds: 1800,
      alertsFound: 1,
    });
    expect(body.groupDescription).toBe("Payments incidents");
  });

  it.each([true, false])("sends requireApprove %s as given", (value) => {
    const form = { ...CREATE_FORM, requireApprove: value };
    const body = buildCorrelationRuleBody(form, {
      timeframeInSeconds: 86400,
      alertsFound: 2,
    });
    expect(body.requireApprove).toBe(value);
    expect(body).toEqual(legacyBody(form, 86400, 2));
  });

  it("sends no grouping when no alert matches the filter", () => {
    const body = buildCorrelationRuleBody(EDIT_FORM, {
      timeframeInSeconds: 1800,
      alertsFound: 0,
    });
    expect(body.groupingCriteria).toEqual([]);
    expect(body).toEqual(legacyBody(EDIT_FORM, 1800, 0));
  });

  it("sends an empty grouping as given", () => {
    const form = { ...CREATE_FORM, groupedAttributes: [] };
    const body = buildCorrelationRuleBody(form, {
      timeframeInSeconds: 86400,
      alertsFound: 7,
    });
    expect(body.groupingCriteria).toEqual([]);
    expect(body).toEqual(legacyBody(form, 86400, 7));
  });

  it("formats the query without parsing numbers", () => {
    const body = buildCorrelationRuleBody(CREATE_FORM, {
      timeframeInSeconds: 86400,
      alertsFound: 1,
    });
    expect(body.sqlQuery.params["labels.team_1"]).toBe("5");
  });
});
