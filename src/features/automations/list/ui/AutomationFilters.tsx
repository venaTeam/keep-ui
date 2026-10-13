import { Button } from "@tremor/react";
import {
  AutomationFilters as Filters,
  BUILD_STATES,
  MATCHING_STATES,
  useAutomationNamespaces,
} from "@/entities/automations";

export function AutomationFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const namespaces = useAutomationNamespaces();
  const names = Array.from(
    new Set([
      ...(namespaces.data ?? []),
      ...(filters.namespace ? [filters.namespace] : []),
    ])
  );
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-4">
        {(
          [
            ["namespace", "Namespace (wallet)", names],
            ["matching_state", "Matching state", MATCHING_STATES],
            ["build_state", "Build state", BUILD_STATES],
          ] as const
        ).map(([key, label, values]) => (
          <div key={key} className="flex flex-col gap-1 text-sm font-medium">
            <label htmlFor={`automations-filter-${key}`}>{label}</label>
            <select
              id={`automations-filter-${key}`}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              data-cy={`automations-filter-${key}`}
              value={filters[key] ?? ""}
              onChange={(event) =>
                onChange({ ...filters, [key]: event.target.value || undefined })
              }
            >
              <option value="">All</option>
              {values.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        ))}
        <Button
          variant="secondary"
          data-cy="automations-clear-filters"
          onClick={() => onChange({})}
        >
          Clear filters
        </Button>
      </div>
      {namespaces.isLoading && <p role="status">Loading namespace options…</p>}
      {namespaces.error && (
        <p role="alert">
          Namespace options could not be loaded.{" "}
          <button
            className="underline"
            data-cy="automations-retry-namespaces"
            onClick={() => void namespaces.mutate()}
          >
            Retry namespace options
          </button>
        </p>
      )}
    </div>
  );
}
