import Link from "next/link";
import { ArrowRightIcon, ClockIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNowStrict } from "date-fns";
import { Automation, automationRoutes, lastRun } from "@/entities/automations";
import { AutomationState } from "@/entities/automations/ui/AutomationValues";
import { Tooltip } from "@/shared/ui/Tooltip";

export function AutomationsTable({
  rows,
  query,
}: {
  rows: Automation[];
  query: string;
}) {
  return (
    <div
      className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      data-cy="automations-table"
    >
      {rows.map((row) => {
        const run = lastRun(row.last_run);
        return (
          <article
            key={row.id}
            data-cy="automation-card"
            className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-orange-300 hover:shadow-md focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-400"
          >
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-4 flex items-start justify-end gap-3">
                <ArrowRightIcon
                  aria-hidden="true"
                  className="mt-2 h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-orange-500"
                />
              </div>
              <h2 className="text-base font-semibold leading-6 text-gray-900">
                <Link
                  href={automationRoutes.detail(row.id, query)}
                  data-cy="automation-detail-link"
                  className="break-words after:absolute after:inset-0 focus:outline-none"
                >
                  {row.name}
                </Link>
              </h2>
              <p className="mt-2 w-fit max-w-full truncate rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600" title={row.namespace}>
                <span className="truncate">
                  {row.namespace}
                </span>
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                <div className="min-w-0">
                  <dt className="mb-1.5 text-xs text-gray-500">
                    Matching state
                  </dt>
                  <dd>
                    <AutomationState state={row.matching_state} />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="mb-1.5 text-xs text-gray-500">Build state</dt>
                  <dd>
                    <AutomationState state={row.build_state} />
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-3 text-left text-xs text-gray-500">
              <ClockIcon
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-gray-400"
              />
              <div className="min-w-0 text-left">
                <span className="mr-1.5">Last run</span>
                {run.timestamp ? (
                  <Tooltip
                    content={new Date(run.timestamp).toLocaleString()}
                    asChild
                  >
                    <time
                      className="relative font-medium text-gray-700"
                      tabIndex={0}
                      dateTime={run.timestamp}
                    >
                      {formatDistanceToNowStrict(new Date(run.timestamp), {
                        addSuffix: true,
                      })}
                    </time>
                  </Tooltip>
                ) : (
                  <span className="font-medium text-gray-600">{run.label}</span>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
