import { ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { HosstedButton } from "@hossted/keep-integration";
import { AlertDto } from "@/entities/alerts/model";

const columnHelper = createColumnHelper<AlertDto>();

/**
 * The alert table's Hossted column, or no column when Hossted is disabled
 * for the current tenant.
 */
export function buildHosstedColumns(enabled: boolean): ColumnDef<AlertDto>[] {
  if (!enabled) {
    return [];
  }
  return [
    columnHelper.display({
      id: "hossted",
      header: "Hossted",
      minSize: 100,
      cell: (context) => (
        <HosstedButton
          request={{
            fingerprint: context.row.original.fingerprint,
            payload: context.row.original,
          }}
          disableHosstedSidePanel
        />
      ),
    }) as ColumnDef<AlertDto>,
  ];
}
