import {
  formatQuery,
  ParameterizedNamedSQL,
  RuleGroupTypeAny,
} from "react-querybuilder";
import { parseCEL } from "react-querybuilder/parseCEL";

// One CEL-to-SQL step for everything that sends a filter as {CEL, SQL}: the
// preset form, the assistant's preset card (parseNumbers: true) and its rule
// card (parseNumbers: false, as the correlation sidebar formats its tree).
//
// parseCEL never throws: what it can't read is dropped, down to SQL `(1 = 1)`.
// derivedForConfirm refuses the cases where nothing is left; the gateway
// catches partial loss by comparing the round trip with the drafted CEL.

export type CelSqlOptions = { parseNumbers: boolean };

export type SqlQuery = ParameterizedNamedSQL;

export const MATCH_ALL_SQL = "(1 = 1)";

export type DerivedBlockedReason = "empty_filter" | "matches_everything";

export type DerivedForConfirm =
  | { cel_roundtrip: string; sql_query: SqlQuery }
  | { blocked: DerivedBlockedReason };

function toSqlQuery(tree: RuleGroupTypeAny, parseNumbers: boolean): SqlQuery {
  return formatQuery(tree, { format: "parameterized_named", parseNumbers });
}

function hasRule(group: RuleGroupTypeAny): boolean {
  return group.rules.some((item) =>
    typeof item === "string"
      ? false
      : "rules" in item
        ? hasRule(item)
        : true
  );
}

export function celToSqlQuery(cel: string, { parseNumbers }: CelSqlOptions) {
  return toSqlQuery(parseCEL(cel), parseNumbers);
}

export function celRoundTrip(cel: string): string {
  return formatQuery(parseCEL(cel), "cel");
}

/** The browser-derived values Confirm sends, both from one parsed tree. */
export function derivedForConfirm(
  cel: string,
  { parseNumbers }: CelSqlOptions
): DerivedForConfirm {
  const tree = parseCEL(cel);
  if (!hasRule(tree)) {
    return { blocked: "empty_filter" };
  }
  const sql_query = toSqlQuery(tree, parseNumbers);
  if (sql_query.sql === MATCH_ALL_SQL) {
    return { blocked: "matches_everything" };
  }
  return { cel_roundtrip: formatQuery(tree, "cel"), sql_query };
}
