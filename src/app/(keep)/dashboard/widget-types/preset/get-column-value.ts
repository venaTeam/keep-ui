import { camelCase } from "lodash";
import { getNestedValue } from "@/shared/lib/object-utils";

/**
 * Reads the value a widget column shows from an alert row.
 *
 * The facet fields list names aliased alert fields in snake_case (`last_received`)
 * while the alert payload carries the camelCase alias (`lastReceived`). When the
 * row has no value under the exact column key, a top-level column falls back to
 * its camelCase key. Dotted columns (`labels.team`) never fall back, because
 * their segments are user-defined label names.
 */
export function getColumnValue(alert: any, column: string) {
  const value = getNestedValue(alert, column);
  if (value !== undefined || column.includes(".")) {
    return value;
  }
  return getNestedValue(alert, camelCase(column));
}
