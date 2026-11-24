import type {
  RuleResolveOn,
  SelectableResolveOn,
} from "@/utils/hooks/useRules";

/** The strategies offered in the rule form, in display order. */
export const SELECTABLE_RESOLVE_ON: readonly SelectableResolveOn[] = [
  "never",
  "all_resolved",
];

export const RESOLVE_ON_LABELS: Record<RuleResolveOn, string> = {
  never: "No auto-resolution",
  all_resolved: "All alerts resolved",
  first_resolved: "First alert resolved",
  last_resolved: "Last alert resolved",
};

export const isSelectableResolveOn = (
  value: string | null | undefined
): value is SelectableResolveOn =>
  SELECTABLE_RESOLVE_ON.some((selectable) => selectable === value);
