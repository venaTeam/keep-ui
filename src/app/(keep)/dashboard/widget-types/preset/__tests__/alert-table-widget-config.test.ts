import { WidgetData } from "../../../types";
import {
  NARROW_WIDGET_PX,
  WIDGET_EXCLUDED_COLUMNS,
  WIDGET_ALERT_FIELD_ALIASES,
  WIDGET_KNOWN_COLUMN_IDS,
  WIDGET_PINNED_LEFT,
  WIDGET_STATIC_COLUMN_IDS,
  applyWidgetColumnChange,
  getGroupByColumnId,
  getVisibleColumnIds,
  getWidgetRowStyle,
  mergeVisibleColumnOrder,
  normalizeColumnOrder,
  resetWidgetColumns,
  resolveFieldIds,
  resolveWidgetColumnId,
  toVisibilityState,
  visibleIdsFromVisibilityState,
  withoutDefaultFormats,
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
  it("keeps an id it knows statically", () => {
    expect(resolveWidgetColumnId("lastReceived")).toBe("lastReceived");
    expect(resolveWidgetColumnId("firingCounter")).toBe("firingCounter");
  });
  it("maps a snake_case id to a fixed column", () =>
    expect(resolveWidgetColumnId("last_received")).toBe("lastReceived"));
  it("maps a snake_case id to a known alert key", () => {
    expect(resolveWidgetColumnId("duplicate_reason")).toBe("duplicateReason");
    expect(resolveWidgetColumnId("is_duplicate")).toBe("isDuplicate");
  });
  it.each([
    ["last_received", "lastReceived"],
    ["firing_start_time", "firingStartTime"],
    [
      "firing_start_time_since_last_resolved",
      "firingStartTimeSinceLastResolved",
    ],
    ["firing_counter", "firingCounter"],
    ["unresolved_counter", "unresolvedCounter"],
    ["is_full_duplicate", "isFullDuplicate"],
    ["is_partial_duplicate", "isPartialDuplicate"],
    ["duplicate_reason", "duplicateReason"],
    ["dismiss_until", "dismissUntil"],
    ["provider_id", "providerId"],
    ["provider_type", "providerType"],
    ["started_at", "startedAt"],
  ])("maps the alert DTO field %s to its alias %s", (field, alias) =>
    expect(resolveWidgetColumnId(field)).toBe(alias)
  );
  it("never camelCases a dotted id", () =>
    expect(resolveWidgetColumnId("labels.team_name")).toBe("labels.team_name"));
  it("keeps a custom snake_case enrichment key as it is", () => {
    expect(resolveWidgetColumnId("ticket_id")).toBe("ticket_id");
    expect(resolveWidgetColumnId("my_custom_field")).toBe("my_custom_field");
  });
  it("keeps a dotted id", () =>
    expect(resolveWidgetColumnId("labels.team")).toBe("labels.team"));
});

describe("WIDGET_KNOWN_COLUMN_IDS", () => {
  it("is the fixed columns, the alert's known keys and the DTO aliases", () => {
    WIDGET_STATIC_COLUMN_IDS.forEach((id) =>
      expect(WIDGET_KNOWN_COLUMN_IDS.has(id)).toBe(true)
    );
    WIDGET_ALERT_FIELD_ALIASES.forEach((id) =>
      expect(WIDGET_KNOWN_COLUMN_IDS.has(id)).toBe(true)
    );
    expect(WIDGET_KNOWN_COLUMN_IDS.has("isDuplicate")).toBe(true);
    expect(WIDGET_KNOWN_COLUMN_IDS.has("myCustomField")).toBe(false);
  });
});

describe("resolveFieldIds", () => {
  it("maps facet ids statically, the same for the form and the panel", () =>
    expect(
      resolveFieldIds(["firing_counter", "labels.team", "my_custom_field"])
    ).toEqual(["firingCounter", "labels.team", "my_custom_field"]));
});

describe("getGroupByColumnId", () => {
  it("resolves the saved groupBy statically, or is undefined when ungrouped", () => {
    expect(
      getGroupByColumnId({
        alertTable: { groupBy: "firing_counter" },
      } as WidgetData)
    ).toBe("firingCounter");
    expect(getGroupByColumnId({} as WidgetData)).toBeUndefined();
  });
});

describe("withoutDefaultFormats", () => {
  it("drops the entries equal to the default format", () =>
    expect(
      withoutDefaultFormats({ a: "timeago", b: "iso" }, "timeago")
    ).toEqual({ b: "iso" }));
  it("returns an empty map when every entry is the default format", () =>
    expect(withoutDefaultFormats({ a: "timeago" }, "timeago")).toEqual({}));
  it("drops empty entries", () =>
    expect(
      withoutDefaultFormats({ a: "" as string, b: "iso" }, "timeago")
    ).toEqual({ b: "iso" }));
});

describe("getWidgetRowStyle", () => {
  it("is relaxed when the widget saved relaxed rows", () =>
    expect(
      getWidgetRowStyle({ alertTable: { rowStyle: "relaxed" } } as WidgetData)
    ).toBe("relaxed"));
  it.each([
    ["no alertTable", {} as WidgetData],
    ["a null rowStyle", { alertTable: { rowStyle: null } } as WidgetData],
    [
      "an unknown rowStyle",
      { alertTable: { rowStyle: "comfortable" } } as unknown as WidgetData,
    ],
  ])("is default for %s", (_, item) =>
    expect(getWidgetRowStyle(item)).toBe("default")
  );
});

describe("getVisibleColumnIds", () => {
  it("uses the widget defaults when presetColumns is unset", () =>
    expect(getVisibleColumnIds({} as WidgetData)).toEqual([
      "severity",
      "status",
      "source",
      "name",
      "description",
      "lastReceived",
    ]));
  it("resolves legacy ids and drops excluded ones", () =>
    expect(
      getVisibleColumnIds({
        presetColumns: ["name", "last_received", "firing_counter", "checkbox"],
      } as WidgetData)
    ).toEqual(["name", "lastReceived", "firingCounter"]));
  it("keeps the first occurrence when a legacy id and its camelCase id both appear", () =>
    expect(
      getVisibleColumnIds({
        presetColumns: ["lastReceived", "name", "last_received"],
      } as WidgetData)
    ).toEqual(["lastReceived", "name"]));
  it("keeps an unknown id so it renders an empty column", () =>
    expect(
      getVisibleColumnIds({
        presetColumns: ["name", "ticket_id"],
      } as WidgetData)
    ).toEqual(["name", "ticket_id"]));
  it("treats an empty presetColumns list as no visible columns", () =>
    expect(
      getVisibleColumnIds({ presetColumns: [] } as unknown as WidgetData)
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
  it("setting the row style back to Compact removes it and keeps the rest", () =>
    expect(
      applyWidgetColumnChange(
        {
          i: "w2",
          alertTable: { columnOrder: ["name"], rowStyle: "relaxed" },
        } as unknown as WidgetData,
        { rowStyle: null }
      ).alertTable
    ).toEqual({ columnOrder: ["name"] }));
  it("removes alertTable when an empty format map leaves nothing", () =>
    expect(
      applyWidgetColumnChange(
        {
          i: "w2",
          alertTable: { columnTimeFormats: { lastReceived: "iso" } },
        } as unknown as WidgetData,
        { columnTimeFormats: {} }
      )
    ).not.toHaveProperty("alertTable"));
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
