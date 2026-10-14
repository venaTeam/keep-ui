import { useState } from "react";
import { Button } from "@tremor/react";
import { AdjustmentsHorizontalIcon, ChevronDownIcon, ChevronLeftIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { AutomationFilters as Filters, BUILD_STATES, MATCHING_STATES, useAutomationNamespaces } from "@/entities/automations";

function FacetSection({ label, value, values, onChange }: { label: string; value?: string; values: readonly string[]; onChange: (value?: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-t border-gray-200 py-3 first:border-t-0">
      <select aria-label={label} className="sr-only" value={value ?? ""} onChange={(event) => onChange(event.target.value || undefined)}>
        <option value="">All</option>{values.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <button type="button" className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        {label}<ChevronDownIcon className={`h-4 w-4 transition ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="mt-2 space-y-1">
        <button type="button" className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${!value ? "bg-orange-50 font-medium text-orange-700" : "text-gray-600 hover:bg-gray-50"}`} onClick={() => onChange(undefined)}>All{!value && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}</button>
        {values.map((option) => <button type="button" key={option} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${value === option ? "bg-orange-50 font-medium text-orange-700" : "text-gray-600 hover:bg-gray-50"}`} onClick={() => onChange(option)}><span className="truncate">{option}</span>{value === option && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}</button>)}
      </div>}
    </section>
  );
}

export function AutomationFilters({ filters, onChange, onCollapse }: { filters: Filters; onChange: (filters: Filters) => void; onCollapse?: () => void }) {
  const namespaces = useAutomationNamespaces();
  const names = Array.from(new Set([...(namespaces.data ?? []), ...(filters.namespace ? [filters.namespace] : [])]));
  const activeCount = Object.values(filters).filter(Boolean).length;
  const update = (key: keyof Filters, value?: string) => onChange({ ...filters, [key]: value || undefined });
  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white shadow-sm" data-cy="automations-facets">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><AdjustmentsHorizontalIcon className="h-4 w-4 text-orange-500" />Filters{activeCount > 0 && <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700">{activeCount}</span>}</div>
        {onCollapse && <button type="button" onClick={onCollapse} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Hide filters" title="Hide filters"><ChevronLeftIcon className="h-4 w-4" /></button>}
      </div>
      <div className="px-3 pb-2">
        <FacetSection label="Namespace (wallet)" value={filters.namespace} values={names} onChange={(value) => update("namespace", value)} />
        <FacetSection label="Matching state" value={filters.matching_state} values={MATCHING_STATES} onChange={(value) => update("matching_state", value)} />
        <FacetSection label="Build state" value={filters.build_state} values={BUILD_STATES} onChange={(value) => update("build_state", value)} />
      </div>
      {activeCount > 0 && <div className="border-t border-gray-200 p-3"><Button variant="secondary" className="w-full" icon={XMarkIcon} data-cy="automations-clear-filters" onClick={() => onChange({})}>Clear filters</Button></div>}
      {namespaces.isLoading && <p role="status" className="px-4 pb-3 text-xs text-gray-500">Loading namespace options…</p>}
      {namespaces.error && <p role="alert" className="px-4 pb-3 text-xs text-red-700">Namespace options could not be loaded. <button className="underline" data-cy="automations-retry-namespaces" onClick={() => void namespaces.mutate()}>Retry namespace options</button></p>}
    </div>
  );
}

