"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { Button } from "@tremor/react";
import {
  FunnelIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { FiFilter } from "react-icons/fi";
import { EmptyStateCard, KeepLoader, PageTitle } from "@/shared/ui";
import { PageSubtitle } from "@/shared/ui/PageSubtitle";
import { SearchInput } from "@/features/filter/search-input";
import { Pagination } from "@/features/filter";
import { useLocalStorage } from "@/utils/hooks/useLocalStorage";
import {
  automationError,
  automationRoutes,
  automationFacetQuery,
  parseAutomationFacets,
  parseAutomationPagination,
  AUTOMATION_PAGE_SIZES,
  useAutomations,
  filterAutomationRows,
  automationFacetCounts,
} from "@/entities/automations";
import { AutomationFilters } from "./AutomationFilters";
import { AutomationsTable } from "./AutomationsTable";

export function AutomationsList() {
  const router = useRouter();
  const params = useSearchParams();
  const [filtersCollapsed, setFiltersCollapsed] = useLocalStorage(
    "facets-collapsed-automations",
    false
  );
  const filters = parseAutomationFacets(params);
  const search = params.get("q") ?? "";
  const pagination = parseAutomationPagination(params);
  const query = automationFacetQuery(filters, search, pagination);
  const onSearch = useCallback(
    (value: string) => {
      if (value === search) return;
      router.replace(
        automationRoutes.list(
          automationFacetQuery(
            parseAutomationFacets(new URLSearchParams(query)),
            value
          )
        ),
        { scroll: false }
      );
    },
    [router, query, search]
  );
  const { data, error, isLoading, isValidating, mutate } = useAutomations({});
  const term = search.trim().toLocaleLowerCase();
  const rows = data ? filterAutomationRows(data, filters, search) : undefined;
  const counts = data
    ? automationFacetCounts(data, filters, search)
    : undefined;
  const hasFilters = Object.values(filters).some((values) => values?.length);
  useEffect(() => {
    if (rows?.length && pagination.offset >= rows.length) {
      router.replace(
        automationRoutes.list(
          automationFacetQuery(filters, search, {
            limit: pagination.limit,
            offset: 0,
          })
        ),
        { scroll: false }
      );
    }
  }, [
    filters,
    pagination.limit,
    pagination.offset,
    router,
    rows?.length,
    search,
  ]);
  return (
    <main className="flex flex-col gap-6" data-cy="automations-list-page">
      <header>
        <PageTitle>Automations</PageTitle>
        <PageSubtitle>
          Manage event-driven automations and their execution state
        </PageSubtitle>
      </header>
      <div role="search" aria-label="Search automations">
        <SearchInput
          placeholder="Search automations"
          value={search}
          onValueChange={onSearch}
        />
        <p className="mt-2 text-xs text-gray-500">
          Search and facet counts apply to loaded automations.
        </p>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside
          className={filtersCollapsed ? "shrink-0" : "w-full shrink-0 lg:w-56"}
        >
          {filtersCollapsed && (
            <button
              type="button"
              onClick={() => setFiltersCollapsed(false)}
              className="flex items-center gap-1 rounded p-2 hover:bg-gray-100"
              aria-label="Show filters"
              title="Show filters"
            >
              <FiFilter className="text-orange-500" size={16} />
              <ChevronRightIcon className="h-4 w-4 text-orange-500" />
            </button>
          )}
          <div className={filtersCollapsed ? "hidden" : "w-full"}>
            <AutomationFilters
              filters={filters}
              counts={counts}
              onCollapse={() => setFiltersCollapsed(true)}
              onChange={(next) =>
                router.replace(
                  automationRoutes.list(automationFacetQuery(next, search)),
                  { scroll: false }
                )
              }
            />
          </div>
        </aside>
        <section
          className="flex min-w-0 flex-1 flex-col gap-4"
          aria-label="Automation results"
        >
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {automationError(error)}{" "}
              <Button
                variant="secondary"
                data-cy="automations-retry"
                onClick={() => void mutate()}
              >
                Retry
              </Button>
            </div>
          )}
          {isLoading && (
            <div className="flex h-96 flex-col items-center justify-center gap-3">
              <KeepLoader includeMinHeight={false} data-testid="keep-loader" />
              <span role="status">Loading automations…</span>
            </div>
          )}
          {isValidating && data && (
            <p
              role="status"
              className="flex items-center gap-2 text-xs text-gray-500"
            >
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              Refreshing automations…
            </p>
          )}
          {rows &&
            (rows.length ? (
              <>
                <AutomationsTable
                  rows={rows.slice(
                    pagination.offset,
                    pagination.offset + pagination.limit
                  )}
                  query={query}
                />
                <Pagination
                  totalCount={rows.length}
                  pageSizeOptions={[...AUTOMATION_PAGE_SIZES]}
                  isRefreshAllowed={false}
                  isRefreshing={false}
                  state={pagination}
                  onStateChange={(next) =>
                    router.replace(
                      automationRoutes.list(
                        automationFacetQuery(filters, search, next)
                      ),
                      { scroll: false }
                    )
                  }
                />
              </>
            ) : (
              <EmptyStateCard
                title={
                  term
                    ? "No automations match your search."
                    : hasFilters
                      ? "No automations match these filters."
                      : "No automations yet."
                }
                icon={term ? MagnifyingGlassIcon : FunnelIcon}
              >
                {term && (
                  <Button variant="secondary" onClick={() => onSearch("")}>
                    Clear search
                  </Button>
                )}
                {hasFilters && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      router.replace(
                        automationRoutes.list(automationFacetQuery({}, search)),
                        { scroll: false }
                      )
                    }
                  >
                    Clear filters
                  </Button>
                )}
              </EmptyStateCard>
            ))}
        </section>
      </div>
    </main>
  );
}
