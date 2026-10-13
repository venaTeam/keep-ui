import Link from "next/link";
import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from "@tremor/react";
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
    <Table data-cy="automations-table">
      <TableHead>
        <TableRow>
          {[
            "Name",
            "Namespace",
            "Matching state",
            "Build state",
            "Digest",
            "Last run",
          ].map((label) => (
            <TableHeaderCell key={label}>{label}</TableHeaderCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const run = lastRun(row.last_run);
          return (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  className="text-orange-700 underline font-medium"
                  data-cy="automation-detail-link"
                  href={automationRoutes.detail(row.id, query)}
                >
                  {row.name}
                </Link>
              </TableCell>
              <TableCell>{row.namespace}</TableCell>
              <TableCell>
                <AutomationState state={row.matching_state} />
              </TableCell>
              <TableCell>
                <AutomationState state={row.build_state} />
              </TableCell>
              <TableCell>
                <AutomationDigest digest={row.active_digest} />
              </TableCell>
              <TableCell>
                {run.timestamp ? (
                  <Tooltip content={run.timestamp} asChild>
                    <time tabIndex={0} dateTime={run.timestamp}>
                      {run.label}
                    </time>
                  </Tooltip>
                ) : (
                  run.label
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
