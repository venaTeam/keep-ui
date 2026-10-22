import {
  automationFacetCounts,
  automationFacetQuery,
  filterAutomationRows,
  parseAutomationFacets,
} from "../facets";
import { Automation } from "../types";

const rows = [
  {
    name: "Restart",
    namespace: "payments",
    matching_state: "active",
    build_state: "idle",
  },
  {
    name: "Recover",
    namespace: "payments",
    matching_state: "active",
    build_state: "building",
  },
  {
    name: "Notify",
    namespace: "platform",
    matching_state: "inactive",
    build_state: "idle",
  },
] as Automation[];

test("multiple selections roundtrip while invalid enum values are ignored", () => {
  const selections = parseAutomationFacets(
    new URLSearchParams(
      "namespace=payments&namespace=offboarded&namespace=payments&build_state=idle&build_state=bad"
    )
  );
  expect(selections).toEqual({
    namespace: ["payments", "offboarded"],
    build_state: ["idle"],
  });
  expect(
    parseAutomationFacets(
      new URLSearchParams(automationFacetQuery(selections, "Restart"))
    )
  ).toEqual(selections);
});

test("values within facets use OR, facets use AND, and search narrows the result", () => {
  expect(
    filterAutomationRows(rows, {
      namespace: ["payments", "platform"],
      build_state: ["idle"],
    })
  ).toEqual([rows[0], rows[2]]);
  expect(
    filterAutomationRows(
      rows,
      { namespace: ["payments", "platform"] },
      "PLATFORM"
    )
  ).toEqual([rows[2]]);
  expect(filterAutomationRows(rows, { namespace: ["offboarded"] })).toEqual([]);
});

test("counts ignore their own selection but respect other facets and search", () => {
  const counts = automationFacetCounts(rows, {
    namespace: ["payments"],
    build_state: ["idle"],
  });
  expect(counts.namespace).toEqual({ payments: 1, platform: 1 });
  expect(counts.build_state).toEqual({ idle: 1, building: 1 });
  expect(automationFacetCounts(rows, {}, "Notify").namespace).toEqual({
    platform: 1,
  });
});
