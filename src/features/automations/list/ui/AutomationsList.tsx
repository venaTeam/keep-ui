"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card } from "@tremor/react";
import { PageTitle } from "@/shared/ui/PageTitle";
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
  const filters = parseFilters(params);
  const query = filterQuery(filters);
  const { data, error, isLoading, isValidating, mutate } =
    useAutomations(filters);
  return (
    <div className="p-6 space-y-6">
      <PageTitle>Automations</PageTitle>
      <AutomationFilters
        filters={filters}
        onChange={(next) =>
          router.replace(automationRoutes.list(filterQuery(next)), {
            scroll: false,
          })
        }
      />
      {error && (
        <div role="alert" className="text-red-700">
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
      {isLoading && <p role="status">Loading automations…</p>}
      {isValidating && data && <p role="status">Refreshing automations…</p>}
      {data && (
        <Card>
          {data.length ? (
            <AutomationsTable rows={data} query={query} />
          ) : (
            <p>
              {query
                ? "No automations match these filters."
                : "No automations yet."}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
