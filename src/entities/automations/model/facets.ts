import { Automation, BUILD_STATES, MATCHING_STATES } from "./types";

export const AUTOMATION_FACETS = [
  "namespace",
  "matching_state",
  "build_state",
] as const;
export type AutomationFacet = (typeof AUTOMATION_FACETS)[number];
export type AutomationSelections = Partial<Record<AutomationFacet, string[]>>;
export const AUTOMATION_PAGE_SIZES = [12, 24, 48] as const;

export function parseAutomationPagination(
  params: Pick<URLSearchParams, "get">
) {
  const rawLimit = Number(params.get("limit"));
  const limit = AUTOMATION_PAGE_SIZES.includes(
    rawLimit as (typeof AUTOMATION_PAGE_SIZES)[number]
  )
    ? rawLimit
    : AUTOMATION_PAGE_SIZES[0];
  const rawPage = Number(params.get("page"));
  const page = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
  return { limit, offset: page * limit };
}

export function parseAutomationFacets(
  params: Pick<URLSearchParams, "getAll">
): AutomationSelections {
  const filters: AutomationSelections = {};
  for (const key of AUTOMATION_FACETS) {
    const allowed: readonly string[] | undefined =
      key === "matching_state"
        ? MATCHING_STATES
        : key === "build_state"
          ? BUILD_STATES
          : undefined;
    const values = [
      ...new Set(
        params
          .getAll(key)
          .filter((value) => value && (!allowed || allowed.includes(value)))
      ),
    ];
    if (values.length) filters[key] = values;
  }
  return filters;
}

export function automationFacetQuery(
  filters: AutomationSelections,
  search = "",
  pagination?: { limit: number; offset: number }
) {
  const params = new URLSearchParams();
  for (const key of AUTOMATION_FACETS)
    for (const value of filters[key] ?? []) params.append(key, value);
  if (search) params.set("q", search);
  if (pagination) {
    params.set("limit", String(pagination.limit));
    params.set(
      "page",
      String(Math.floor(pagination.offset / pagination.limit))
    );
  }
  return params.toString();
}

// Facets and their counts cover the returned list, not an assumed global total.
// Values within one facet are ORed; different facets are ANDed.
export function filterAutomationRows(
  rows: Automation[],
  filters: AutomationSelections,
  search = "",
  except?: AutomationFacet
) {
  const term = search.trim().toLocaleLowerCase();
  return rows.filter(
    (row) =>
      (!term ||
        [row.name, row.namespace].some((value) =>
          value.toLocaleLowerCase().includes(term)
        )) &&
      AUTOMATION_FACETS.every(
        (key) =>
          key === except ||
          !filters[key]?.length ||
          filters[key]!.includes(row[key])
      )
  );
}

export function automationFacetCounts(
  rows: Automation[],
  filters: AutomationSelections,
  search = ""
) {
  return Object.fromEntries(
    AUTOMATION_FACETS.map((key) => {
      const counts: Record<string, number> = Object.create(null);
      for (const row of filterAutomationRows(rows, filters, search, key))
        counts[row[key]] = (counts[row[key]] ?? 0) + 1;
      return [key, counts];
    })
  ) as Record<AutomationFacet, Record<string, number>>;
}
