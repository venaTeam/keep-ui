export const MATCHING_STATES = [
  "inactive",
  "active",
  "deleting",
  "deleted",
] as const;
export const BUILD_STATES = ["idle", "building", "build_failed"] as const;
export type MatchingState = (typeof MATCHING_STATES)[number];
export type BuildState = (typeof BUILD_STATES)[number];
export type AutomationFilters = {
  namespace?: string;
  matching_state?: MatchingState;
  build_state?: BuildState;
};
export interface Automation {
  id: string;
  name: string;
  namespace: string;
  matching_state: MatchingState;
  build_state: BuildState;
  active_digest: string | null;
  contract_version: string | null;
  triggers: { field: string; value: string }[];
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  // Provisional UI projection until automation-contracts.md pins UI payloads.
  last_run?: unknown;
}
export interface AutomationDetail extends Automation {
  script: string | null;
  secret_name: string | null;
  cooldown_seconds: number | null;
  cooldown_fields: string[] | null;
  timeout_seconds: number | null;
  grace_seconds: number | null;
  logstash_url: string | null;
  delete_cascade_step: number | null;
  index_generation: number;
}
export type LifecycleResponse = Pick<
  AutomationDetail,
  | "id"
  | "matching_state"
  | "build_state"
  | "active_digest"
  | "delete_cascade_step"
  | "index_generation"
  | "updated_at"
  | "updated_by"
>;
export type AutomationAction = "enable" | "disable" | "delete";
