import { formatQuery } from "react-querybuilder";
import { CorrelationFormType } from "./types";

type CorrelationRuleBodyContext = {
  timeframeInSeconds: number;
  // Alerts the filter matches now; with none, the grouping is not sent.
  alertsFound: number;
};

/** The body of POST /rules (create) and PUT /rules/{id} (edit). */
export function buildCorrelationRuleBody(
  correlationFormData: CorrelationFormType,
  { timeframeInSeconds, alertsFound }: CorrelationRuleBodyContext
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
    groupingCriteria: alertsFound ? groupedAttributes : [],
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
