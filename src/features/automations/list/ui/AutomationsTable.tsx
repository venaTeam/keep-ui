import Link from "next/link";
import { Card } from "@tremor/react";
import { Automation, automationRoutes, lastRun } from "@/entities/automations";
import {
  AutomationDigest,
  AutomationState,
} from "@/entities/automations/ui/AutomationValues";
import { Tooltip } from "@/shared/ui/Tooltip";

export function AutomationsTable({
  rows,
  query,
}: {
  rows: Automation[];
  query: string;
}) {
  return (
    <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-cy="automations-table">
      {rows.map((row) => {
        const run = lastRun(row.last_run);
        return (
          <Card key={row.id} className="group flex min-h-56 flex-col justify-between border border-gray-200 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link className="block truncate text-base font-semibold text-gray-900 transition group-hover:text-orange-700" data-cy="automation-detail-link" href={automationRoutes.detail(row.id, query)}>{row.name}</Link>
                  <p className="mt-1 truncate text-sm text-gray-500">{row.namespace}</p>
                </div>
                <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-orange-700">Automation</span>
              </div>
              <div className="grid grid-cols-2 gap-3 border-y border-gray-100 py-3">
                <div><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Matching</p><div className="mt-1"><AutomationState state={row.matching_state} /></div></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Build</p><div className="mt-1"><AutomationState state={row.build_state} /></div></div>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3 text-xs text-gray-500">
              <div><p className="uppercase tracking-wide text-gray-400">Digest</p><AutomationDigest digest={row.active_digest} /></div>
              <div className="text-right"><p className="uppercase tracking-wide text-gray-400">Last run</p>{run.timestamp ? <Tooltip content={run.timestamp} asChild><time tabIndex={0} dateTime={run.timestamp}>{run.label}</time></Tooltip> : run.label}</div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
