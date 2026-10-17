import { useId, useState } from "react";
import { ChevronDownIcon, ChevronLeftIcon } from "@heroicons/react/24/outline";
import { FacetValue } from "@/features/filter/facet-value";
import {
  AutomationSelections,
  AutomationFacet,
  BUILD_STATES,
  MATCHING_STATES,
  useAutomationNamespaces,
} from "@/entities/automations";

function FacetSection({
  label,
  selected = [],
  values,
  counts,
  onChange,
}: {
  label: string;
  selected?: string[];
  values: readonly string[];
  counts?: Record<string, number>;
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState("");
  const id = useId();
  const visible = values.filter((value) =>
    value.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  );
  return (
    <section className="border-b border-gray-200 pb-3 pt-2 last:border-b-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={id}
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-2 text-left text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:outline-orange-500"
        >
          <ChevronDownIcon
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-gray-500 ${open ? "" : "-rotate-90"}`}
          />
          {label}
          {selected.length > 0 && (
            <span className="text-xs text-orange-600">{selected.length}</span>
          )}
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange([])}
            className="rounded px-2 text-xs text-orange-600 hover:text-orange-800 focus-visible:outline-orange-500"
          >
            Clear
          </button>
        )}
      </div>
      {!open && selected.length > 0 && (
        <p
          className="truncate px-8 pb-1 text-xs text-gray-500"
          title={selected.join(", ")}
        >
          {selected.join(", ")}
        </p>
      )}
      {open && (
        <div id={id} role="group" aria-label={label}>
          {values.length > 8 && (
            <input
              aria-label={`Search ${label.toLowerCase()} options`}
              placeholder="Filter values…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mb-2 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-orange-400 focus:outline-none"
            />
          )}
          <div className="max-h-60 overflow-y-auto">
            {visible.map((value) => (
              <div key={value} role="group" aria-label={value}>
                <FacetValue
                  label={value}
                  count={counts?.[value] ?? (counts ? 0 : undefined)}
                  isSelected={selected.includes(value)}
                  isExclusivelySelected={
                    selected.length === 1 && selected[0] === value
                  }
                  isSelectable
                  showIcon={false}
                  renderLabel={() => value}
                  onToggleOption={() =>
                    onChange(
                      selected.includes(value)
                        ? selected.filter((item) => item !== value)
                        : [...selected, value]
                    )
                  }
                  onSelectOneOption={() => onChange([value])}
                  onSelectAllOptions={() => onChange([])}
                />
              </div>
            ))}
            {!visible.length && (
              <p className="px-2 py-1 text-xs text-gray-500">
                No matching values
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function AutomationFilters({
  filters,
  counts,
  onChange,
  onCollapse,
}: {
  filters: AutomationSelections;
  counts?: Record<AutomationFacet, Record<string, number>>;
  onChange: (filters: AutomationSelections) => void;
  onCollapse?: () => void;
}) {
  const namespaces = useAutomationNamespaces();
  const names = [
    ...new Set([...(namespaces.data ?? []), ...(filters.namespace ?? [])]),
  ];
  const activeCount = Object.values(filters).reduce(
    (sum, values) => sum + (values?.length ?? 0),
    0
  );
  const update = (key: AutomationFacet, values: string[]) => {
    const next = { ...filters };
    if (values.length) next[key] = values;
    else delete next[key];
    onChange(next);
  };
  return (
    <div className="w-full" data-cy="automations-facets">
      <div className="flex items-center justify-end px-2 pb-2">
        {activeCount > 0 && (
          <span className="text-xs font-normal text-gray-500" aria-label={`${activeCount} active filters`}>
            {activeCount} selected
          </span>
        )}
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="rounded p-1 hover:bg-gray-100"
            aria-label="Hide filters"
            title="Hide filters"
          >
            <ChevronLeftIcon className="h-4 w-4 text-orange-500" />
          </button>
        )}
      </div>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange({})}
          data-cy="automations-clear-filters"
          className="mb-1 rounded px-2 py-1 text-xs text-orange-600 hover:bg-gray-100"
        >
          Clear filters
        </button>
      )}
      <FacetSection
        label="Wallet"
        selected={filters.namespace}
        values={names}
        counts={counts?.namespace}
        onChange={(values) => update("namespace", values)}
      />
      <FacetSection
        label="Matching state"
        selected={filters.matching_state}
        values={MATCHING_STATES}
        counts={counts?.matching_state}
        onChange={(values) => update("matching_state", values)}
      />
      <FacetSection
        label="Build state"
        selected={filters.build_state}
        values={BUILD_STATES}
        counts={counts?.build_state}
        onChange={(values) => update("build_state", values)}
      />
      {namespaces.isLoading && (
        <p role="status" className="px-2 text-xs text-gray-500">
          Loading wallet options…
        </p>
      )}
      {namespaces.error && (
        <p role="alert" className="px-2 text-xs text-red-700">
          Wallet options could not be loaded.{" "}
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
