import useSWR, { SWRConfiguration } from "swr";
import { useApi } from "@/shared/lib/hooks/useApi";
import { CelAst } from "../cel-ast";

// The two strategies a rule may be saved with.
export type SelectableResolveOn = "never" | "all_resolved";
// Strategies of rules created before they were retired. Such a rule still
// loads and runs, but cannot be saved until moved to a SelectableResolveOn.
export type LegacyResolveOn = "first_resolved" | "last_resolved";
export type RuleResolveOn = SelectableResolveOn | LegacyResolveOn;

export type Rule = {
  id: string;
  name: string;
  item_description: string | null;
  group_description: string | null;
  grouping_criteria: string[];
  definition_cel: string;
  definition_cel_ast: CelAst.Node;
  definition: { sql: string; params: {} };
  timeframe: number;
  timeunit: "minutes" | "seconds" | "hours" | "days";
  created_by: string;
  creation_time: string;
  tenant_id: string;
  updated_by: string | null;
  update_time: string | null;
  require_approve: boolean;
  resolve_on: RuleResolveOn;
  create_on: "any" | "all";
  distribution: { [group: string]: { [timestamp: string]: number } };
  incidents: number;
  incident_name_template: string | null;
  incident_prefix: string | null;
  multi_level: boolean;
  multi_level_property_name: string | null;
  threshold: number;
  assignee: string | undefined;
};

export const useRules = (options?: SWRConfiguration) => {
  const api = useApi();

  return useSWR<Rule[]>(
    api.isReady() ? "/rules" : null,
    (url) => api.get(url),
    options
  );
};
