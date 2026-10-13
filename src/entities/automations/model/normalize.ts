import { AutomationFilters, BUILD_STATES, MATCHING_STATES } from "./types";

export function lastRun(value: unknown): { label: string; timestamp?: string } {
  if (value === null) return { label: "Never run" };
  if (
    typeof value === "object" &&
    value &&
    "created_at" in value &&
    typeof value.created_at === "string"
  ) {
    const date = new Date(value.created_at);
    if (!Number.isNaN(date.getTime()))
      return { label: date.toLocaleString(), timestamp: value.created_at };
  }
  return { label: "Unavailable" };
}

// Provisional endpoint shape; never infer available wallets from list rows.
export function normalizeNamespaces(value: unknown): string[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("namespaces" in value) ||
    !Array.isArray(value.namespaces)
  ) {
    throw new Error("Namespace options are unavailable");
  }
  const names = value.namespaces.map((item: unknown) => {
    if (
      !item ||
      typeof item !== "object" ||
      !("namespace" in item) ||
      typeof item.namespace !== "string"
    )
      throw new Error("Invalid namespace option");
    return item.namespace;
  });
  return Array.from(new Set(names)).sort();
}

export function parseFilters(
  params: Pick<URLSearchParams, "get">
): AutomationFilters {
  const matching = params.get("matching_state");
  const build = params.get("build_state");
  return {
    namespace: params.get("namespace") || undefined,
    matching_state: MATCHING_STATES.find((state) => state === matching),
    build_state: BUILD_STATES.find((state) => state === build),
  };
}
export function filterQuery(filters: AutomationFilters) {
  const params = new URLSearchParams();
  for (const key of ["namespace", "matching_state", "build_state"] as const) {
    if (filters[key]) params.set(key, filters[key]!);
  }
  return params.toString();
}
export const automationRoutes = {
  list: (query = "") => `/automations${query ? `?${query}` : ""}`,
  detail: (id: string, query = "") =>
    `/automations/${encodeURIComponent(id)}${query ? `?${query}` : ""}`,
  edit: (id: string) => `/automations/${encodeURIComponent(id)}/edit`,
};
