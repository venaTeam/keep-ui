import {
  filterQuery,
  lastRun,
  normalizeNamespaces,
  parseFilters,
} from "../normalize";
import { isAutomationListKey } from "../automationKeys";
import { unstable_serialize } from "swr";
test("last run distinguishes null, omitted and malformed summaries", () => {
  expect(lastRun(null).label).toBe("Never run");
  expect(lastRun(undefined).label).toBe("Unavailable");
  expect(lastRun({ created_at: "invalid" }).label).toBe("Unavailable");
  expect(
    lastRun({ id: "run-1", created_at: "2026-10-12T12:00:00Z" }).timestamp
  ).toBe("2026-10-12T12:00:00Z");
});
test("filters validate enums and encode wallet names", () => {
  expect(
    filterQuery(
      parseFilters(
        new URLSearchParams(
          "namespace=team%26one&matching_state=wrong&build_state=build_failed"
        )
      )
    )
  ).toBe("namespace=team%26one&build_state=build_failed");
});
test("namespaces use the dedicated projection and reject malformed responses", () => {
  expect(
    normalizeNamespaces({
      namespaces: [{ namespace: "b" }, { namespace: "a" }, { namespace: "a" }],
    })
  ).toEqual(["a", "b"]);
  expect(() => normalizeNamespaces({ automations: [] })).toThrow();
});
test("list invalidation includes filters only in the same session scope", () => {
  expect(
    isAutomationListKey(
      ["automations", "tenant-a", "/automations?namespace=payments"],
      "tenant-a"
    )
  ).toBe(true);
  expect(
    isAutomationListKey(["automations", "tenant-b", "/automations"], "tenant-a")
  ).toBe(false);
  expect(
    isAutomationListKey(
      ["automations", "tenant-a", "/automations/id"],
      "tenant-a"
    )
  ).toBe(false);
  expect(
    isAutomationListKey(
      unstable_serialize([
        "automations",
        "tenant-a",
        "/automations?namespace=payments",
      ]),
      "tenant-a"
    )
  ).toBe(true);
});
