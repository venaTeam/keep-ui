"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@tremor/react";
import { FunnelIcon, ArrowPathIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { EmptyStateCard, KeepLoader, PageTitle } from "@/shared/ui";
import { PageSubtitle } from "@/shared/ui/PageSubtitle";
import {
  automationError,
  automationRoutes,
  filterQuery,
  parseFilters,
  useAutomations,
} from "@/entities/automations";
import { AutomationFilters } from "./AutomationFilters";
import { AutomationsTable } from "./AutomationsTable";

export function AutomationsList() {
  const router = useRouter();
  const params = useSearchParams();
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const filters = parseFilters(params);
  const query = filterQuery(filters);
  const { data, error, isLoading, isValidating, mutate } =
    useAutomations(filters);
  return (
    <main className="flex flex-col gap-8" data-cy="automations-list-page">
      <header className="flex flex-col gap-1">
        <PageTitle>Automations</PageTitle>
        <PageSubtitle>Manage event-driven automations and their execution state</PageSubtitle>
      </header>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <aside className={filtersCollapsed ? "w-full shrink-0 lg:w-10" : "w-full shrink-0 lg:w-64"}>
          {filtersCollapsed ? (
            <button type="button" onClick={() => setFiltersCollapsed(false)} className="flex items-center gap-1 rounded p-2 text-orange-500 hover:bg-gray-100" aria-label="Show filters" title="Show filters"><FunnelIcon className="h-4 w-4" /><ChevronRightIcon className="h-4 w-4" /></button>
          ) : (
            <AutomationFilters filters={filters} onCollapse={() => setFiltersCollapsed(true)} onChange={(next) => router.replace(automationRoutes.list(filterQuery(next)), { scroll: false })} />
          )}
        </aside>
        <section className="flex min-w-0 flex-1 flex-col gap-4">
        {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
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
      {isLoading && <div className="flex flex-col items-center justify-center gap-3 py-16"><KeepLoader includeMinHeight={false} data-testid="keep-loader" /><span role="status">Loading automations…</span></div>}
      {isValidating && data && <p role="status" className="flex items-center gap-2 text-xs text-gray-500"><ArrowPathIcon className="h-4 w-4 animate-spin" />Refreshing automations…</p>}
      {data && (
        data.length ? (
          <AutomationsTable rows={data} query={query} />
        ) : (
          <EmptyStateCard title={query ? "No automations match these filters." : "No automations yet."} icon={FunnelIcon}>
            {query && <Button variant="secondary" onClick={() => router.replace(automationRoutes.list(), { scroll: false })}>Clear filters</Button>}
          </EmptyStateCard>
        )
      )}
        </section>
      </div>
    </main>
  );
}
