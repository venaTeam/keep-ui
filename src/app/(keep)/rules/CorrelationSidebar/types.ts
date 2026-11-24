import { RuleGroupType } from "react-querybuilder";
import type { RuleResolveOn } from "@/utils/hooks/useRules";

export type CorrelationFormType = {
  name: string;
  description: string;
  timeAmount: number;
  timeUnit: "minutes" | "seconds" | "hours" | "days";
  groupedAttributes: string[];
  requireApprove: boolean;
  resolveOn: RuleResolveOn;
  createOn: "any" | "all";
  query: RuleGroupType;
  incidentNameTemplate: string;
  incidentPrefix: string;
  multiLevel: boolean;
  multiLevelPropertyName?: string;
  threshold: number;
  assignee?: string;
};
