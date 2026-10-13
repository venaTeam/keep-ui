import { useState } from "react";
import Link from "next/link";
import { Button } from "@tremor/react";
import { Tooltip } from "@/shared/ui/Tooltip";
import {
  AutomationDetail,
  automationRoutes,
  useAutomationActions,
} from "@/entities/automations";
import { useConfig } from "@/utils/hooks/useConfig";
import { AutomationConfirmation } from "../../lifecycle/ui/AutomationConfirmation";
export const ENABLE_TOOLTIP =
  "This automation must complete its first successful build before it can be enabled.";

export function AutomationActions({
  automation,
}: {
  automation: AutomationDetail;
}) {
  const { data: config } = useConfig();
  const { run, pending, message, needsRefresh, retryRefresh } =
    useAutomationActions(automation.id);
  const [confirmation, setConfirmation] = useState<"delete" | "disable" | null>(
    null
  );
  const active = automation.matching_state === "active";
  const unavailable =
    pending ||
    needsRefresh ||
    !!config?.READ_ONLY ||
    ["deleting", "deleted"].includes(automation.matching_state);
  const building = automation.build_state === "building";
  const missingDigest = !active && !automation.active_digest?.trim();
  const reason = config?.READ_ONLY
    ? "Application is in read-only mode."
    : pending
      ? "An action is in progress."
      : needsRefresh
        ? "Refresh the state before retrying an action."
        : ["deleting", "deleted"].includes(automation.matching_state)
          ? "This automation is being deleted or has been deleted."
          : missingDigest
            ? ENABLE_TOOLTIP
            : "";
  const toggle = (
    <Button
      data-cy="automation-toggle"
      disabled={unavailable || missingDigest}
      onClick={() => (active ? setConfirmation("disable") : void run("enable"))}
    >
      {active ? "Disable" : "Enable"}
    </Button>
  );
  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-center">
        {reason ? (
          <Tooltip content={reason} asChild>
            <span
              tabIndex={0}
              aria-label={reason}
              data-cy="automation-toggle-help"
            >
              {toggle}
            </span>
          </Tooltip>
        ) : (
          toggle
        )}
        {unavailable || building ? (
          <Tooltip
            content={
              building
                ? "Editing is unavailable while a build is running."
                : reason
            }
            asChild
          >
            <span tabIndex={0}>
              <Button variant="secondary" data-cy="automation-edit" disabled>
                Edit
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Link
            className="rounded-md border border-orange-500 px-4 py-2 text-sm text-orange-700"
            data-cy="automation-edit"
            href={automationRoutes.edit(automation.id)}
          >
            Edit
          </Link>
        )}
        <Tooltip
          content={
            building
              ? "Deletion is unavailable while a build is running."
              : "Delete automation"
          }
          asChild
        >
          <span tabIndex={unavailable || building ? 0 : undefined}>
            <Button
              color="red"
              variant="secondary"
              data-cy="automation-delete"
              disabled={unavailable || building}
              onClick={() => setConfirmation("delete")}
            >
              Delete
            </Button>
          </span>
        </Tooltip>
      </div>
      {message && <p role="status">{message}</p>}
      {needsRefresh && (
        <Button
          variant="secondary"
          data-cy="automation-refresh-state"
          disabled={pending}
          onClick={() => void retryRefresh()}
        >
          Refresh state
        </Button>
      )}
      <AutomationConfirmation
        action={confirmation}
        pending={pending}
        blocked={unavailable || (confirmation === "delete" && building)}
        onCancel={() => setConfirmation(null)}
        onConfirm={async () => {
          if (confirmation && (await run(confirmation))) setConfirmation(null);
        }}
      />
    </div>
  );
}
