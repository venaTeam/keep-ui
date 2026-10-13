"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Card } from "@tremor/react";
import { PageTitle } from "@/shared/ui/PageTitle";
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
    <div className="p-6 space-y-6">
      <Link
        href={automationRoutes.list(filterQuery(parseFilters(params)))}
        className="text-orange-700 underline"
        data-cy="automations-back"
      >
        Back to automations
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
          <header className="space-y-3">
            <PageTitle>{row.name}</PageTitle>
            <p>Namespace (wallet): {row.namespace}</p>
            <div className="flex flex-wrap gap-4">
              <span>
                Matching state: <AutomationState state={row.matching_state} />
              </span>
              <span>
                Build state: <AutomationState state={row.build_state} />
              </span>
            </div>
          </header>
          <AutomationActions key={row.id} automation={row} />
          {row.matching_state === "deleting" && (
            <p role="status">
              Deletion in progress
              {row.delete_cascade_step != null
                ? ` (last completed step: ${row.delete_cascade_step})`
                : ""}
              . New executions have stopped.
            </p>
          )}
          {row.matching_state === "deleted" && (
            <p role="status">
              Deletion completed. Execution audit records are retained.
            </p>
          )}
          <Card>
            <AutomationDefinition automation={row} />
          </Card>
          <Card>
            <h2 className="text-lg font-semibold mb-4">Metadata</h2>
            <dl className="space-y-3">
              <div>
                <dt>Active digest</dt>
                <dd>
                  <AutomationDigest digest={row.active_digest} full />
                </dd>
              </div>
              <div>
                <dt>Contract version</dt>
                <dd>{row.contract_version ?? "Unavailable"}</dd>
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
                  <dt>{label}</dt>
                  <dd>{value ?? "Unavailable"}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </>
      )}
    </div>
  );
}
