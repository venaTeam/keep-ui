import type { ChangeEvent } from "react";
import type { TableFeature } from "@tanstack/react-table";
import type { AlertDto } from "@/entities/alerts/model/types";
import { setIdsTicked } from "./selection";

/**
 * A table feature that makes a group row's selection handler tick or untick
 * every selectable row under it, the group row itself never entering the
 * selection. The widget makes group rows unselectable, and TanStack's own
 * handler does nothing for a row that cannot be selected, so without it the
 * shared group header checkbox would do nothing.
 */
export const GROUP_ROW_SELECTION: TableFeature<AlertDto> = {
  createRow: (row, table) => {
    const getOwnHandler = row.getToggleSelectedHandler;
    row.getToggleSelectedHandler = () => {
      if (!row.getIsGrouped()) {
        return getOwnHandler();
      }
      return (event: unknown) => {
        const tick = (event as ChangeEvent<HTMLInputElement>).target.checked;
        const ids = row
          .getLeafRows()
          .filter((leaf) => leaf.getCanSelect())
          .map((leaf) => leaf.id);
        table.setRowSelection((old) => setIdsTicked(old, ids, tick));
      };
    };
  },
};
