import { AlertDto } from "@/entities/alerts/model/types";
import {
  getEligibleAlerts,
  getRangeIds,
  getStripLabel,
  pruneSelection,
  setIdsTicked,
} from "../selection";
import { WidgetAlertAction } from "../types";

const alert = (fields: Record<string, unknown>) =>
  ({
    id: "a",
    fingerprint: "fp",
    name: "disk-full",
    status: "firing",
    lastReceived: "2026-11-16T10:00:00Z",
    source: ["prometheus"],
    ...fields,
  }) as unknown as AlertDto;

describe("pruneSelection", () => {
  it("returns the same object when every key is shown", () => {
    const s = { a: true, b: true };
    expect(pruneSelection(s, ["a", "b", "c"])).toBe(s);
  });
  it("drops keys that are not shown", () =>
    expect(pruneSelection({ a: true, b: true }, ["b"])).toEqual({ b: true }));
  it("drops everything for an empty list", () =>
    expect(pruneSelection({ a: true }, [])).toEqual({}));
});
describe("setIdsTicked", () => {
  it("ticks the ids on a new object, keeping the rest", () => {
    const s = { a: true };
    const next = setIdsTicked(s, ["b", "c"], true);
    expect(next).toEqual({ a: true, b: true, c: true });
    expect(next).not.toBe(s);
    expect(s).toEqual({ a: true });
  });
  it("removes unticked ids instead of storing false", () => {
    const s = { a: true, b: true, c: true };
    const next = setIdsTicked(s, ["a", "b"], false);
    expect(next).toEqual({ c: true });
    expect(Object.values(next)).not.toContain(false);
    expect(s).toEqual({ a: true, b: true, c: true });
  });
  it("drops false values it is given", () =>
    expect(setIdsTicked({ a: true, b: false }, ["c"], true)).toEqual({ a: true, c: true }));
  it("leaves an empty object when the last id is unticked", () =>
    expect(setIdsTicked({ a: true }, ["a"], false)).toEqual({}));
});
describe("getRangeIds", () => {
  const order = ["a", "b", "c", "d"];
  it("is inclusive forwards", () => expect(getRangeIds(order, "b", "d")).toEqual(["b", "c", "d"]));
  it("is inclusive backwards, in display order", () => expect(getRangeIds(order, "d", "b")).toEqual(["b", "c", "d"]));
  it("is just the target when the anchor is gone", () => expect(getRangeIds(order, "x", "c")).toEqual(["c"]));
});
describe("getStripLabel", () => {
  const link = { label: "Link to incident", partialLabel: (n: number) => `Link ${n} to incident` } as WidgetAlertAction;
  it("uses the plain label when every ticked alert goes in", () => expect(getStripLabel(link, 4, 4)).toBe("Link to incident"));
  it("counts when some are left out", () => expect(getStripLabel(link, 3, 4)).toBe("Link 3 to incident"));
});
describe("getEligibleAlerts", () => {
  it("keeps only alerts the action applies to, in order", () => {
    const action = { appliesTo: (a: AlertDto) => a.status === "firing" } as WidgetAlertAction;
    const [x, y, z] = [alert({ fingerprint: "x", status: "firing" }), alert({ fingerprint: "y", status: "resolved" }), alert({ fingerprint: "z", status: "firing" })];
    expect(getEligibleAlerts(action, [x, y, z])).toEqual([x, z]);
  });
});
