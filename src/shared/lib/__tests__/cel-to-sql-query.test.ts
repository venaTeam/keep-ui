/**
 * cel-vectors.json is generated from CEL_VECTOR_INPUTS below. It is read by
 * this test and copied by keep-api-gateway (tests/assistant/cel_vectors.py),
 * whose CEL subset checker and AST-equality check must agree with it.
 *
 * Regenerate after changing the inputs or upgrading react-querybuilder (bash):
 *   UPDATE_CEL_VECTORS=1 npx jest src/shared/lib/__tests__/cel-to-sql-query.test.ts
 * then review the diff. Never hand-edit the computed fields.
 *
 * Entry fields:
 * - cel, parse_numbers: the inputs.
 * - subset (hand-labelled): whether the spec's CEL subset (§3.7) allows the
 *   expression: comparisons == != < <= > >= between a field path and a
 *   literal, `in [literals]`, .contains/.startsWith/.endsWith with a literal,
 *   &&, ||, negation only as `!( … )`, dotted field paths, literals.
 * - lossy (hand-labelled): whether parseCEL drops or changes something, i.e.
 *   `roundtrip` is not AST-equal to `cel` (parentheses and whitespace ignored).
 * - sql: celToSqlQuery(cel, {parseNumbers}), the `{sql, params}` object.
 * - roundtrip: celRoundTrip(cel).
 * - blocked: present only when derivedForConfirm refuses the CEL; its reason.
 * - note: why the vector is here.
 */
import fs from "fs";
import path from "path";
import { parseCEL } from "react-querybuilder/parseCEL";
import {
  celRoundTrip,
  celToSqlQuery,
  derivedForConfirm,
} from "../cel-to-sql-query";

// Lets one test force the SQL formatQuery returns; null passes it through.
let mockForcedSql: string | null = null;
jest.mock("react-querybuilder", () => {
  const actual = jest.requireActual("react-querybuilder");
  return {
    ...actual,
    formatQuery: (...args: unknown[]) => {
      const result = actual.formatQuery(...args);
      return mockForcedSql !== null && typeof result === "object"
        ? { ...result, sql: mockForcedSql }
        : result;
    },
  };
});

type VectorInput = {
  cel: string;
  subset: boolean;
  lossy: boolean;
  note: string;
};

const CEL_VECTOR_INPUTS: VectorInput[] = [
  // The subset, one construct at a time
  { cel: 'severity == "critical"', subset: true, lossy: false, note: "==" },
  { cel: 'status != "resolved"', subset: true, lossy: false, note: "!=" },
  { cel: "count > 5", subset: true, lossy: false, note: "> with a number" },
  { cel: "count >= 5", subset: true, lossy: false, note: ">=" },
  { cel: "count < 5", subset: true, lossy: false, note: "<" },
  { cel: "count <= 5", subset: true, lossy: false, note: "<=" },
  { cel: "count == 3.5", subset: true, lossy: false, note: "a decimal" },
  { cel: "count > -2", subset: true, lossy: false, note: "a negative number" },
  {
    cel: 'name == "1"',
    subset: true,
    lossy: false,
    note: "a numeric-looking string: parseNumbers turns the param into a number",
  },
  {
    cel: 'severity > "info"',
    subset: true,
    lossy: false,
    note: "ordering on a string",
  },
  { cel: 'name == ""', subset: true, lossy: false, note: "an empty string literal" },
  {
    cel: 'status in ["firing", "acknowledged"]',
    subset: true,
    lossy: false,
    note: "in with strings",
  },
  {
    cel: "count in [1, 2]",
    subset: true,
    lossy: true,
    note: "in with numbers: the round trip quotes them",
  },
  {
    cel: 'count in [1, "two"]',
    subset: true,
    lossy: true,
    note: "in with mixed literals: the round trip quotes the number",
  },
  { cel: 'name.contains("db")', subset: true, lossy: false, note: "contains" },
  { cel: 'name.contains("")', subset: true, lossy: false, note: "contains an empty string" },
  { cel: 'name.startsWith("db")', subset: true, lossy: false, note: "startsWith" },
  { cel: 'name.endsWith("prod")', subset: true, lossy: false, note: "endsWith" },
  {
    cel: 'severity == "critical" && source == "grafana"',
    subset: true,
    lossy: false,
    note: "&&",
  },
  {
    cel: 'severity == "critical" || severity == "high"',
    subset: true,
    lossy: false,
    note: "||",
  },
  {
    cel: "(a == 1 || b == 2) && (c == 3 || d == 4)",
    subset: true,
    lossy: false,
    note: "nested parentheses",
  },
  {
    cel: '((severity == "critical"))',
    subset: true,
    lossy: false,
    note: "redundant parentheses are dropped",
  },
  {
    cel: "count >= 2 && count <= 10 || count < 0",
    subset: true,
    lossy: false,
    note: "precedence: the round trip adds parentheses",
  },
  {
    cel: '!(name.contains("db"))',
    subset: true,
    lossy: false,
    note: "negated contains: the round trip drops the parentheses, and that text alone parses to nothing",
  },
  {
    cel: '!(severity == "low" || status == "resolved")',
    subset: true,
    lossy: false,
    note: "negated group",
  },
  {
    cel: '!(severity == "low") && status == "firing"',
    subset: true,
    lossy: false,
    note: "negated comparison next to another",
  },
  {
    cel: 'labels.team == "payments"',
    subset: true,
    lossy: false,
    note: "labels.x: the params key is labels.team_1",
  },
  {
    cel: 'labels.team.contains("pay")',
    subset: true,
    lossy: false,
    note: "labels.x with contains",
  },
  { cel: 'service.name == "api"', subset: true, lossy: false, note: "a dotted field" },
  { cel: 'a.b.c == "d"', subset: true, lossy: false, note: "a deeper dotted field" },
  { cel: "dismissed == true", subset: true, lossy: false, note: "boolean true" },
  { cel: "dismissed == false", subset: true, lossy: false, note: "boolean false" },
  { cel: "assignee == null", subset: true, lossy: false, note: "== null" },
  { cel: "assignee != null", subset: true, lossy: false, note: "!= null" },
  {
    cel: '  severity == "high"  ',
    subset: true,
    lossy: false,
    note: "surrounding whitespace",
  },
  {
    cel: 'name == "it\\"s"',
    subset: true,
    lossy: true,
    note: "an escaped quote in a literal: parseCEL drops the expression",
  },
  // Refused or lossy constructs
  {
    cel: '!name.contains("db")',
    subset: false,
    lossy: true,
    note: "negation without parentheses",
  },
  { cel: "!dismissed", subset: false, lossy: true, note: "bare negated field" },
  { cel: 'name.matches("db.*")', subset: false, lossy: true, note: "matches() is dropped" },
  {
    cel: 'count > 5 && name.matches("db.*")',
    subset: false,
    lossy: true,
    note: "partly dropped: not blocked by the browser, the AST check must catch it",
  },
  { cel: "has(labels.team)", subset: false, lossy: true, note: "has()" },
  { cel: "size(name) > 2", subset: false, lossy: true, note: "size()" },
  { cel: "count + 1 == 2", subset: false, lossy: true, note: "arithmetic" },
  { cel: "count * 2 > 4", subset: false, lossy: true, note: "arithmetic" },
  {
    cel: 'severity == "high" ? true : false',
    subset: false,
    lossy: true,
    note: "ternary",
  },
  { cel: 'tags.exists(t, t == "x")', subset: false, lossy: true, note: "a macro" },
  {
    cel: 'labels["team"] == "x"',
    subset: false,
    lossy: true,
    note: "index access instead of a dotted path",
  },
  {
    cel: "name.contains(other)",
    subset: false,
    lossy: false,
    note: "contains with a field, not a literal",
  },
  { cel: "source == service", subset: false, lossy: false, note: "field compared with a field" },
  { cel: "1 == 1", subset: false, lossy: false, note: "no field comparison" },
  { cel: 'severity == "high" &&', subset: false, lossy: true, note: "a syntax error" },
  { cel: "", subset: false, lossy: true, note: "empty" },
  { cel: "   ", subset: false, lossy: true, note: "blank" },
];

const VECTORS_PATH = path.join(__dirname, "cel-vectors.json");

function computeVectorFile() {
  const vectors = CEL_VECTOR_INPUTS.flatMap((input) =>
    [true, false].map((parseNumbers) => {
      const derived = derivedForConfirm(input.cel, { parseNumbers });
      return {
        cel: input.cel,
        parse_numbers: parseNumbers,
        subset: input.subset,
        lossy: input.lossy,
        sql: celToSqlQuery(input.cel, { parseNumbers }),
        roundtrip: celRoundTrip(input.cel),
        ...("blocked" in derived ? { blocked: derived.blocked } : {}),
        note: input.note,
      };
    })
  );
  return {
    _about:
      "Generated by keep-ui src/shared/lib/__tests__/cel-to-sql-query.test.ts; see its header. Do not hand-edit.",
    react_querybuilder: require("react-querybuilder/package.json").version,
    vectors,
  };
}

describe("cel-vectors.json", () => {
  it("equals the freshly computed values", () => {
    const computed = computeVectorFile();
    if (process.env.UPDATE_CEL_VECTORS === "1") {
      fs.writeFileSync(VECTORS_PATH, JSON.stringify(computed, null, 2) + "\n");
    }
    const stored = JSON.parse(fs.readFileSync(VECTORS_PATH, "utf8"));
    expect(stored).toEqual(computed);
  });

  it("covers every input with both parseNumbers settings", () => {
    const stored = JSON.parse(fs.readFileSync(VECTORS_PATH, "utf8"));
    expect(stored.vectors).toHaveLength(CEL_VECTOR_INPUTS.length * 2);
  });

  it("blocks every input that parses to nothing", () => {
    for (const input of CEL_VECTOR_INPUTS) {
      const empty = parseCEL(input.cel).rules.length === 0;
      const derived = derivedForConfirm(input.cel, { parseNumbers: true });
      expect({ cel: input.cel, blocked: "blocked" in derived }).toEqual({
        cel: input.cel,
        blocked: empty,
      });
    }
  });
});

describe("celToSqlQuery", () => {
  it("keys a labels.x param with the dotted field name", () => {
    expect(
      celToSqlQuery('labels.team == "payments"', { parseNumbers: false })
    ).toEqual({
      sql: "(labels.team = :labels.team_1)",
      params: { "labels.team_1": "payments" },
    });
  });

  it("parses numeric strings only with parseNumbers", () => {
    expect(celToSqlQuery("count in [1, 2]", { parseNumbers: true })).toEqual({
      sql: "(count in (:count_1, :count_2))",
      params: { count_1: 1, count_2: 2 },
    });
    expect(celToSqlQuery("count in [1, 2]", { parseNumbers: false })).toEqual({
      sql: "(count in (:count_1, :count_2))",
      params: { count_1: "1", count_2: "2" },
    });
  });

  it("negates a parenthesized contains", () => {
    expect(
      celToSqlQuery('!(name.contains("db"))', { parseNumbers: true })
    ).toEqual({ sql: "(name not like :name_1)", params: { name_1: "%db%" } });
  });

  it("turns an unparseable expression into a match-all", () => {
    for (const cel of ['!name.contains("db")', 'name.matches("x")']) {
      expect(celToSqlQuery(cel, { parseNumbers: true })).toEqual({
        sql: "(1 = 1)",
        params: {},
      });
    }
  });
});

describe("celRoundTrip", () => {
  it("formats the parsed tree back to CEL", () => {
    expect(celRoundTrip("count >= 2 && count <= 10 || count < 0")).toBe(
      "(count >= 2 && count <= 10) || count < 0"
    );
    expect(celRoundTrip('!(name.contains("db"))')).toBe('!name.contains("db")');
    expect(celRoundTrip('name.matches("x")')).toBe("1 == 1");
  });
});

describe("derivedForConfirm", () => {
  it("derives the round trip and the SQL from the same CEL", () => {
    const cel = 'labels.team == "payments" && count > "3"';
    expect(derivedForConfirm(cel, { parseNumbers: true })).toEqual({
      cel_roundtrip: celRoundTrip(cel),
      sql_query: celToSqlQuery(cel, { parseNumbers: true }),
    });
    expect(derivedForConfirm(cel, { parseNumbers: false })).toEqual({
      cel_roundtrip: 'labels.team == "payments" && count > "3"',
      sql_query: {
        sql: "(labels.team = :labels.team_1 and count > :count_1)",
        params: { "labels.team_1": "payments", count_1: "3" },
      },
    });
  });

  it.each(["", "   ", '!name.contains("db")', 'name.matches("x")', "has(x)"])(
    "blocks %j, which parses to nothing",
    (cel) => {
      expect(derivedForConfirm(cel, { parseNumbers: true })).toEqual({
        blocked: "empty_filter",
      });
    }
  );

  it("blocks a filter whose SQL matches everything", () => {
    mockForcedSql = "(1 = 1)";
    try {
      expect(
        derivedForConfirm('severity == "high"', { parseNumbers: true })
      ).toEqual({ blocked: "matches_everything" });
    } finally {
      mockForcedSql = null;
    }
  });
});
