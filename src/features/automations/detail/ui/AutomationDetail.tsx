"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Card } from "@tremor/react";
import { ArrowLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { PageTitle } from "@/shared/ui/PageTitle";
import { PageSubtitle } from "@/shared/ui/PageSubtitle";
import { KeepApiError } from "@/shared/api/KeepApiError";
import {
  automationError,
  automationRoutes,
  filterQuery,
  parseFilters,
  useAutomationDetail,
} from "@/entities/automations";
import {
  AutomationDigest,
  AutomationState,
} from "@/entities/automations/ui/AutomationValues";
import { AutomationDefinition } from "./AutomationDefinition";
import { AutomationActions } from "./AutomationActions";

export function AutomationDetail({ automationId }: { automationId: string }) {
  const params = useSearchParams();
  const {
    data: row,
    error,
    isLoading,
    mutate,
  } = useAutomationDetail(automationId);
  const unavailable = error instanceof KeepApiError && error.statusCode === 404;
  return (
    <main className="flex flex-col gap-6" data-cy="automation-detail-page">
      <Link
        href={automationRoutes.list(filterQuery(parseFilters(params)))}
        className="flex w-fit items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-orange-700"
        data-cy="automations-back"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Back to automations
      </Link>
      {isLoading && <p role="status">Loading automation…</p>}
      {error && (
        <div role="alert">
          {automationError(error)}{" "}
          <Button
            variant="secondary"
            data-cy="automation-retry"
            onClick={() => void mutate()}
          >
            Retry
          </Button>
        </div>
      )}
      {row && !unavailable && (
        <>
          <header className="flex flex-col gap-4 border-b border-gray-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <PageTitle>{row.name}</PageTitle>
              <PageSubtitle>{row.namespace}</PageSubtitle>
              <div className="flex flex-wrap gap-2 pt-1"><AutomationState state={row.matching_state} /><AutomationState state={row.build_state} /></div>
            </div>
            <AutomationActions key={row.id} automation={row} />
          </header>
          {row.matching_state === "deleting" && (
            <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
              Deletion in progress
              {row.delete_cascade_step != null
                ? ` (last completed step: ${row.delete_cascade_step})`
                : ""}
              . New executions have stopped.
            </p>
          )}
          {row.matching_state === "deleted" && (
            <p role="status" className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Deletion completed. Execution audit records are retained.
            </p>
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.55fr)]">
            <Card className="p-6 shadow-sm">
              <AutomationDefinition automation={row} />
            </Card>
            <Card className="p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-semibold text-gray-900">Metadata</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active digest</dt>
                <dd>
                  <AutomationDigest digest={row.active_digest} full />
                </dd>
              </div>
              <div>
                <dt>Contract version</dt>
                <dd className="mt-1">{row.contract_version ?? "Unavailable"}</dd>
              </div>
              {(
                [
                  ["Created at", row.created_at],
                  ["Created by", row.created_by],
                  ["Updated at", row.updated_at],
                  ["Updated by", row.updated_by],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
                    <dd className="mt-1 break-all text-sm text-gray-800">{value ?? "Unavailable"}</dd>
                </div>
              ))}
            </dl>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
