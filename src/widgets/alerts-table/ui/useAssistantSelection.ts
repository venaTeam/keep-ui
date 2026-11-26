import { useEffect, useRef } from "react";
import { Table } from "@tanstack/react-table";
import { AlertDto } from "@/entities/alerts/model";
import { SelectedAlert, useAssistantContextStore } from "@/entities/assistant";

// An alert of another page is only a key of the selection
function toSelectedAlert(
  fingerprint: string,
  alert: AlertDto | undefined
): SelectedAlert {
  return alert
    ? {
        fingerprint,
        name: alert.name,
        severity: alert.severity,
        status: alert.status,
      }
    : { fingerprint };
}

/** Tells the assistant which alerts are ticked in the table. */
export function useAssistantSelection(
  table: Table<AlertDto>,
  isEnabled: boolean
): void {
  const setSelection = useAssistantContextStore((state) => state.setSelection);
  const clearSelection = useAssistantContextStore(
    (state) => state.clearSelection
  );
  // Ticking a group adds the id of its header row to the selection, where it
  // stays after the group itself is gone
  const groupIds = useRef(new Set<string>());

  const { rowSelection } = table.getState();
  const rowsById = isEnabled ? table.getCoreRowModel().rowsById : null;
  const groupedRowsById = isEnabled
    ? table.getGroupedRowModel().rowsById
    : null;

  useEffect(() => {
    if (!rowsById || !groupedRowsById) {
      return;
    }
    Object.values(groupedRowsById).forEach((row) => {
      if (row.getIsGrouped()) {
        groupIds.current.add(row.id);
      }
    });
    setSelection(
      Object.keys(rowSelection)
        .filter((key) => rowSelection[key] && !groupIds.current.has(key))
        .map((key) => toSelectedAlert(key, rowsById[key]?.original))
    );
  }, [rowSelection, rowsById, groupedRowsById, setSelection]);

  useEffect(
    () => (isEnabled ? clearSelection : undefined),
    [isEnabled, clearSelection]
  );
}
