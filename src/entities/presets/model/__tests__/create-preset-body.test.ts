import { formatQuery } from "react-querybuilder";
import { parseCEL } from "react-querybuilder/parseCEL";
import { createPresetBody } from "../usePresetActions";
import { PresetCreateUpdateDto } from "../types";

// Characterization: the body the preset form sends must not change when the
// CEL-to-SQL step moves to the shared helper. `legacyBody` is the inline code
// usePresetActions had before, copied verbatim.
function legacyBody(data: PresetCreateUpdateDto) {
  const sqlQuery = formatQuery(parseCEL(data.CEL), {
    format: "parameterized_named",
    parseNumbers: true,
  });
  return {
    name: data.name,
    options: [
      { label: "CEL", value: data.CEL },
      { label: "SQL", value: sqlQuery },
    ],
    is_private: data.isPrivate,
    is_noisy: data.isNoisy,
    counter_shows_firing_only: data.counterShowsFiringOnly,
    tags: data.tags,
  };
}

const CELS = [
  'severity == "critical"',
  'labels.team == "payments"',
  'status in ["firing", "acknowledged"]',
  "count in [1, 2]",
  'name == "1"',
  "count > 5 && dismissed == false",
  '!(name.contains("db"))',
  '!name.contains("db")',
  'name.matches("db.*")',
  'source.startsWith("graf") || source.endsWith("dog")',
  "(a == 1 || b == 2) && (c == 3 || d == 4)",
  "assignee == null",
  "",
];

function dto(cel: string): PresetCreateUpdateDto {
  return {
    name: "My preset",
    CEL: cel,
    isPrivate: true,
    isNoisy: false,
    counterShowsFiringOnly: true,
    tags: [{ id: "t1", name: "team" }, { name: "new" }],
  };
}

describe("createPresetBody", () => {
  it.each(CELS)("sends the same body as before for %j", (cel) => {
    expect(createPresetBody(dto(cel))).toEqual(legacyBody(dto(cel)));
  });

  it("sends the CEL as typed and the parameterized SQL with numbers parsed", () => {
    expect(createPresetBody(dto('severity == "high" && count >= "3"'))).toEqual(
      {
        name: "My preset",
        options: [
          { label: "CEL", value: 'severity == "high" && count >= "3"' },
          {
            label: "SQL",
            value: {
              sql: "(severity = :severity_1 and count >= :count_1)",
              params: { severity_1: "high", count_1: 3 },
            },
          },
        ],
        is_private: true,
        is_noisy: false,
        counter_shows_firing_only: true,
        tags: [{ id: "t1", name: "team" }, { name: "new" }],
      }
    );
  });
});
