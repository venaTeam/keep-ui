/**
 * Tells whether a grouped column's value counts as "no value".
 *
 * Grouping keys come from the value's string form, so besides `null`,
 * `undefined`, `""` and `[]` the literal strings `"undefined"` and `"null"`
 * are treated as empty too.
 */
export function isEmptyGroupValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value === "" || value === "undefined" || value === "null";
  }
  return Array.isArray(value) && value.length === 0;
}
