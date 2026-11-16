import { WidgetData } from "../../../types";
import {
  NARROW_WIDGET_PX,
  WIDGET_EXCLUDED_COLUMNS,
  WIDGET_PINNED_LEFT,
  WIDGET_STATIC_COLUMN_IDS,
  applyWidgetColumnChange,
  getKnownColumnIds,
  getVisibleColumnIds,
  mergeVisibleColumnOrder,
  normalizeColumnOrder,
  resetWidgetColumns,
  resolveWidgetColumnId,
  toVisibilityState,
  visibleIdsFromVisibilityState,
} from "../alert-table-widget-config";

describe("constants", () => {
  it("excludes the row-chrome columns", () =>
    expect(WIDGET_EXCLUDED_COLUMNS).toEqual(["checkbox", "alertMenu", "noise"]));
  it("pins severity, status and source to the left", () =>
    expect(WIDGET_PINNED_LEFT).toEqual(["severity", "status", "source"]));
  it("treats a widget under 320px as narrow", () =>
    expect(NARROW_WIDGET_PX).toBe(320));
  it("lists the static column ids without the excluded ones", () => {
    expect(WIDGET_STATIC_COLUMN_IDS).toEqual([
      "severity",
      "status",
      "source",
      "name",
      "description",
      "lastReceived",
      "assignee",
      "extraPayload",
    ]);
    WIDGET_EXCLUDED_COLUMNS.forEach((id) =>
      expect(WIDGET_STATIC_COLUMN_IDS).not.toContain(id)
    );
  });
});

describe("resolveWidgetColumnId", () => {
  const known = new Set(["name", "lastReceived", "service", "labels.team"]);
  it("keeps an id the table knows", () =>
    expect(resolveWidgetColumnId("service", known)).toBe("service"));
  it("maps a snake_case id to a known camelCase column", () =>
    expect(resolveWidgetColumnId("last_received", known)).toBe("lastReceived"));
  it("never camelCases a dotted id", () =>
    expect(resolveWidgetColumnId("labels.team_name", known)).toBe(
      "labels.team_name"
    ));
  it("keeps an unknown id as-is so it renders an empty column", () =>
    expect(resolveWidgetColumnId("ticket_id", known)).toBe("ticket_id"));
  it("keeps a known dotted id", () =>
    expect(resolveWidgetColumnId("labels.team", known)).toBe("labels.team"));
});

describe("getKnownColumnIds", () => {
  it("knows the fixed columns and the alert's known keys without alerts", () => {
    const known = getKnownColumnIds();
    WIDGET_STATIC_COLUMN_IDS.forEach((id) => expect(known.has(id)).toBe(true));
    expect(known.has("duplicateReason")).toBe(true);
    expect(known.has("isDuplicate")).toBe(true);
    expect(known.has("firingCounter")).toBe(false);
  });

  it("adds the given loaded ids", () => {
    const known = getKnownColumnIds(["firingCounter", "labels.team"]);
    expect(known.has("firingCounter")).toBe(true);
    expect(known.has("labels.team")).toBe(true);
  });

  it("lets a snake_case id resolve to a known alert key", () => {
    expect(resolveWidgetColumnId("duplicate_reason", getKnownColumnIds())).toBe(
      "duplicateReason"
    );
    expect(resolveWidgetColumnId("is_duplicate", getKnownColumnIds())).toBe(
      "isDuplicate"
    );
  });
});

describe("getVisibleColumnIds", () => {
  const known = new Set([
    "severity",
    "status",
    "source",
    "name",
    "description",
    "lastReceived",
    "checkbox",
  ]);
  it("uses the widget defaults when presetColumns is unset", () =>
    expect(getVisibleColumnIds({} as WidgetData, known)).toEqual([
      "severity",
      "status",
      "source",
      "name",
      "description",
      "lastReceived",
    ]));
  it("resolves legacy ids and drops excluded ones", () =>
    expect(
      getVisibleColumnIds(
        { presetColumns: ["name", "last_received", "checkbox"] } as WidgetData,
        known
      )
    ).toEqual(["name", "lastReceived"]));
  it("keeps the first occurrence when a legacy id and its camelCase id both appear", () =>
    expect(
      getVisibleColumnIds(
        { presetColumns: ["lastReceived", "name", "last_received"] } as WidgetData,
        known
      )
    ).toEqual(["lastReceived", "name"]));
  it("keeps an unknown id so it renders an empty column", () =>
    expect(
      getVisibleColumnIds(
        { presetColumns: ["name", "ticket_id"] } as WidgetData,
        known
      )
    ).toEqual(["name", "ticket_id"]));
  it("treats an empty presetColumns list as no visible columns", () =>
    expect(
      getVisibleColumnIds({ presetColumns: [] } as unknown as WidgetData, known)
    ).toEqual([]));
});

describe("normalizeColumnOrder", () => {
  it("drops unknown ids and appends missing ones in allIds order", () =>
    expect(
      normalizeColumnOrder(
        ["description", "gone", "name"],
        ["severity", "name", "description", "service"]
      )
    ).toEqual(["description", "name", "severity", "service"]));
  it("drops duplicate ids", () =>
    expect(normalizeColumnOrder(["name", "name"], ["name", "severity"])).toEqual(
      ["name", "severity"]
    ));
  it("returns allIds order for an empty order", () =>
    expect(normalizeColumnOrder([], ["b", "a"])).toEqual(["b", "a"]));
});

describe("mergeVisibleColumnOrder", () => {
  it("puts the visible ids in their new order and keeps hidden ids in place", () =>
    expect(
      mergeVisibleColumnOrder(
        ["severity", "name", "environment", "description", "service"],
        ["severity", "description", "name"]
      )
    ).toEqual(["severity", "description", "environment", "name", "service"]));
  it("returns the full order unchanged when the visible order is unchanged", () =>
    expect(
      mergeVisibleColumnOrder(["a", "hidden", "b"], ["a", "b"])
    ).toEqual(["a", "hidden", "b"]));
  it("keeps the visible sequence when it names an id the full order lacks", () =>
    expect(mergeVisibleColumnOrder(["a", "hidden"], ["new", "a"])).toEqual([
      "new",
      "hidden",
      "a",
    ]));
});

describe("toVisibilityState", () => {
  it("marks every id in allIds as visible or hidden", () =>
    expect(toVisibilityState(["name", "ghost"], ["name", "service"])).toEqual({
      name: true,
      service: false,
    }));
});

describe("visibility round trip", () => {
  it("hiding one column keeps the rest in their previous order", () =>
    expect(
      visibleIdsFromVisibilityState(
        { name: false, service: true, description: true },
        ["service", "name", "description"]
      )
    ).toEqual(["service", "description"]));
  it("a newly shown column is appended", () =>
    expect(
      visibleIdsFromVisibilityState({ name: true, service: true }, ["name"])
    ).toEqual(["name", "service"]));
  it("keeps a previously visible column the state does not mention", () =>
    expect(
      visibleIdsFromVisibilityState({ service: true }, ["name"])
    ).toEqual(["name", "service"]));
  it("survives a toVisibilityState round trip", () => {
    const all = ["a", "b", "c"];
    expect(
      visibleIdsFromVisibilityState(toVisibilityState(["c", "a"], all), ["c", "a"])
    ).toEqual(["c", "a"]);
  });
});

describe("applyWidgetColumnChange / resetWidgetColumns", () => {
  const item = {
    i: "w1",
    presetColumns: ["name"],
    alertTable: { columnSizing: { name: 200 } },
  } as unknown as WidgetData;
  it("merges into alertTable without dropping other keys", () =>
    expect(applyWidgetColumnChange(item, { groupBy: "incident" }).alertTable).toEqual({
      columnSizing: { name: 200 },
      groupBy: "incident",
    }));
  it("writes visibleColumns to presetColumns", () =>
    expect(
      applyWidgetColumnChange(item, { visibleColumns: ["name", "service"] })
        .presetColumns
    ).toEqual(["name", "service"]));
  it("leaves alertTable alone when only visibleColumns change", () =>
    expect(
      applyWidgetColumnChange(item, { visibleColumns: ["name"] }).alertTable
    ).toEqual({ columnSizing: { name: 200 } }));
  it("keeps presetColumns when only alertTable keys change", () =>
    expect(
      applyWidgetColumnChange(item, { columnOrder: ["name"] }).presetColumns
    ).toEqual(["name"]));
  it("clearing groupBy removes it and its emptyGroupPosition, keeping the rest", () =>
    expect(
      applyWidgetColumnChange(
        {
          ...item,
          alertTable: {
            columnSizing: { name: 200 },
            groupBy: "service",
            emptyGroupPosition: "bottom",
          },
        },
        { groupBy: null }
      ).alertTable
    ).toEqual({ columnSizing: { name: 200 } }));
  it("removes alertTable when clearing groupBy leaves nothing", () => {
    const next = applyWidgetColumnChange(
      {
        i: "w2",
        alertTable: { groupBy: "service", emptyGroupPosition: "bottom" },
      } as unknown as WidgetData,
      { groupBy: null }
    );
    expect(next).not.toHaveProperty("alertTable");
  });
  it("removes empty sizing, renames and order", () => {
    const next = applyWidgetColumnChange(
      { i: "w2" } as unknown as WidgetData,
      { columnSizing: {}, columnRenameMapping: {}, columnOrder: [] }
    );
    expect(next).not.toHaveProperty("alertTable");
  });
  it("removes an empty map while keeping the other settings", () =>
    expect(
      applyWidgetColumnChange(item, { columnSizing: {}, groupBy: "incident" })
        .alertTable
    ).toEqual({ groupBy: "incident" }));
  it("keeps an emptyGroupPosition the change does not clear the grouping for", () =>
    expect(
      applyWidgetColumnChange({ i: "w2" } as unknown as WidgetData, {
        emptyGroupPosition: "bottom",
      }).alertTable
    ).toEqual({ emptyGroupPosition: "bottom" }));
  it("keeps an empty presetColumns list, which hides every column", () =>
    expect(
      applyWidgetColumnChange(item, { visibleColumns: [] }).presetColumns
    ).toEqual([]));
  it("creates alertTable when the widget has none", () =>
    expect(
      applyWidgetColumnChange({ i: "w2" } as unknown as WidgetData, {
        emptyGroupPosition: "bottom",
        columnRenameMapping: { name: "Alert" },
      }).alertTable
    ).toEqual({
      emptyGroupPosition: "bottom",
      columnRenameMapping: { name: "Alert" },
    }));
  it("does not mutate the input", () => {
    applyWidgetColumnChange(item, { groupBy: "x", visibleColumns: ["y"] });
    expect(item.alertTable).toEqual({ columnSizing: { name: 200 } });
    expect(item.presetColumns).toEqual(["name"]);
  });
  it("reset removes presetColumns and alertTable", () => {
    const reset = resetWidgetColumns(item);
    expect(reset.presetColumns).toBeUndefined();
    expect(reset.alertTable).toBeUndefined();
    expect(reset).not.toHaveProperty("presetColumns");
    expect(reset).not.toHaveProperty("alertTable");
    expect(reset.i).toBe("w1");
  });
  it("reset does not mutate the input", () => {
    resetWidgetColumns(item);
    expect(item.presetColumns).toEqual(["name"]);
    expect(item.alertTable).toEqual({ columnSizing: { name: 200 } });
  });
});
