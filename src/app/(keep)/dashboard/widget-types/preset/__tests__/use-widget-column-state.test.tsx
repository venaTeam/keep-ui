import { act, renderHook } from "@testing-library/react";
import { WidgetData, WidgetType } from "../../../types";
import { defaultColumns } from "../constants";
import { useWidgetColumnState } from "../use-widget-column-state";

const baseItem = {
  i: "w1",
  x: 0,
  y: 0,
  w: 4,
  h: 4,
  static: false,
  name: "Alerts",
  widgetType: WidgetType.PRESET,
} as WidgetData;

beforeEach(() => localStorage.clear());

describe("useWidgetColumnState", () => {
  it("falls back to the shared default order and no renames when the widget has none", () => {
    const { result } = renderHook(() =>
      useWidgetColumnState({
        item: baseItem,
        allColumnIds: ["description", "service", "name", "severity"],
      })
    );
    expect(result.current.columnOrder).toEqual([
      "severity",
      "name",
      "description",
      "service",
    ]);
    expect(result.current.columnRenameMapping).toEqual({});
    expect(result.current.isCustomized).toBe(false);
  });

  it("ignores whatever the viewer's browser holds for the preset", () => {
    localStorage.setItem(
      "keephq-column-order-atw",
      JSON.stringify(["description", "name"])
    );
    localStorage.setItem(
      "keephq-column-rename-mapping-atw",
      JSON.stringify({ name: "Mine" })
    );
    const { result } = renderHook(() =>
      useWidgetColumnState({
        item: baseItem,
        allColumnIds: ["name", "description"],
      })
    );
    expect(result.current.columnOrder).toEqual(["name", "description"]);
    expect(result.current.columnRenameMapping).toEqual({});
  });

  it("two changes in the same tick both survive", () => {
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      useWidgetColumnState({
        item: baseItem,
        allColumnIds: ["name", "service"],
        onChange,
      })
    );
    act(() => {
      result.current.setGrouping(["incident"]);
      result.current.setEmptyGroupPosition("bottom");
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        alertTable: expect.objectContaining({
          groupBy: "incident",
          emptyGroupPosition: "bottom",
        }),
      })
    );
  });

  it("widget order wins over the default and is normalized", () => {
    const item = { ...baseItem, alertTable: { columnOrder: ["name", "ghost"] } };
    const { result } = renderHook(() =>
      useWidgetColumnState({
        item,
        allColumnIds: ["severity", "name", "service"],
      })
    );
    expect(result.current.columnOrder).toEqual(["name", "severity", "service"]);
  });

  it("each setting falls back independently", () => {
    const item = {
      ...baseItem,
      alertTable: { columnRenameMapping: { description: "Details" } },
    };
    const { result } = renderHook(() =>
      useWidgetColumnState({ item, allColumnIds: ["description", "name"] })
    );
    expect(result.current.columnOrder).toEqual(["name", "description"]);
    expect(result.current.columnRenameMapping).toEqual({
      description: "Details",
    });
  });

  it("reset emits one change that removes presetColumns and alertTable", () => {
    const onChange = jest.fn();
    const item = {
      ...baseItem,
      presetColumns: ["name"],
      alertTable: { groupBy: "incident" },
    };
    const { result } = renderHook(() =>
      useWidgetColumnState({ item, allColumnIds: ["name"], onChange })
    );
    act(() => result.current.reset());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].presetColumns).toBeUndefined();
    expect(onChange.mock.calls[0][0].alertTable).toBeUndefined();
  });

  it("setters emit the updated item through onChange", () => {
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      useWidgetColumnState({
        item: baseItem,
        allColumnIds: ["name", "service"],
        onChange,
      })
    );
    act(() => result.current.setGrouping(["incident"]));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        alertTable: expect.objectContaining({ groupBy: "incident" }),
      })
    );
    act(() => result.current.setColumnSizing((prev) => ({ ...prev, name: 240 })));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        alertTable: expect.objectContaining({ columnSizing: { name: 240 } }),
      })
    );
  });

  it("every column, including generated ones not in DEFAULT_COLS, is in the order", () => {
    const { result } = renderHook(() =>
      useWidgetColumnState({
        item: baseItem,
        allColumnIds: ["name", "description", "service"],
      })
    );
    expect(result.current.columnOrder).toEqual(["name", "description", "service"]);
  });

  it("without onChange the setters are no-ops and canEdit is false", () => {
    const { result } = renderHook(() =>
      useWidgetColumnState({ item: baseItem, allColumnIds: [] })
    );
    expect(result.current.canEdit).toBe(false);
    expect(() => act(() => result.current.setGrouping(["incident"]))).not.toThrow();
  });

  it("canEdit is true when onChange is given", () => {
    const { result } = renderHook(() =>
      useWidgetColumnState({
        item: baseItem,
        allColumnIds: [],
        onChange: jest.fn(),
      })
    );
    expect(result.current.canEdit).toBe(true);
  });

  it("grouping defaults to none and emptyGroupPosition to top", () => {
    const { result } = renderHook(() =>
      useWidgetColumnState({ item: baseItem, allColumnIds: [] })
    );
    expect(result.current.grouping).toEqual([]);
    expect(result.current.emptyGroupPosition).toBe("top");
  });

  describe("visibility", () => {
    it("uses the widget default columns when presetColumns is unset", () => {
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item: baseItem,
          allColumnIds: [
            "severity",
            "status",
            "source",
            "name",
            "description",
            "lastReceived",
            "service",
          ],
        })
      );
      expect(result.current.visibleColumns).toEqual(defaultColumns);
      expect(result.current.columnVisibility).toEqual({
        severity: true,
        status: true,
        source: true,
        name: true,
        description: true,
        lastReceived: true,
        service: false,
      });
    });

    it("reads visibleColumns from presetColumns", () => {
      const item = { ...baseItem, presetColumns: ["name", "service"] };
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item,
          allColumnIds: ["name", "service", "description"],
        })
      );
      expect(result.current.visibleColumns).toEqual(["name", "service"]);
      expect(result.current.columnVisibility).toEqual({
        name: true,
        service: true,
        description: false,
      });
    });

    it("setColumnVisibility writes the ordered visible ids to presetColumns", () => {
      const onChange = jest.fn();
      const item = { ...baseItem, presetColumns: ["name", "service"] };
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item,
          allColumnIds: ["name", "service", "description"],
          onChange,
        })
      );
      act(() =>
        result.current.setColumnVisibility({
          name: true,
          service: false,
          description: true,
        })
      );
      expect(onChange.mock.calls[0][0].presetColumns).toEqual([
        "name",
        "description",
      ]);
    });

    it("two visibility changes in the same tick compose", () => {
      const onChange = jest.fn();
      const item = { ...baseItem, presetColumns: ["name"] };
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item,
          allColumnIds: ["name", "service", "description"],
          onChange,
        })
      );
      act(() => {
        result.current.setColumnVisibility({ service: true });
        result.current.setColumnVisibility({ description: true });
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          presetColumns: ["name", "service", "description"],
        })
      );
    });

    it("setVisibleColumns writes the ids to presetColumns", () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item: baseItem,
          allColumnIds: ["name", "service"],
          onChange,
        })
      );
      act(() => result.current.setVisibleColumns(["service"]));
      expect(onChange.mock.calls[0][0].presetColumns).toEqual(["service"]);
    });
  });

  describe("full-map setters", () => {
    it("setColumnRenameMapping stores the full mapping and keeps the other settings", () => {
      const onChange = jest.fn();
      const item = { ...baseItem, alertTable: { columnSizing: { name: 200 } } };
      const { result } = renderHook(() =>
        useWidgetColumnState({ item, allColumnIds: ["name"], onChange })
      );
      act(() => result.current.setColumnRenameMapping({ name: "Title" }));
      expect(onChange.mock.calls[0][0].alertTable).toEqual({
        columnSizing: { name: 200 },
        columnRenameMapping: { name: "Title" },
      });
    });

    it("setColumnSizing resolves the updater against the full stored map", () => {
      const onChange = jest.fn();
      const item = {
        ...baseItem,
        alertTable: { columnSizing: { name: 200, service: 120 } },
      };
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item,
          allColumnIds: ["name", "service"],
          onChange,
        })
      );
      act(() => result.current.setColumnSizing((prev) => ({ ...prev, name: 240 })));
      expect(onChange.mock.calls[0][0].alertTable.columnSizing).toEqual({
        name: 240,
        service: 120,
      });
    });

    it("accepts a plain value as the sizing updater", () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item: baseItem,
          allColumnIds: ["name"],
          onChange,
        })
      );
      act(() => result.current.setColumnSizing({ name: 300 }));
      expect(onChange.mock.calls[0][0].alertTable.columnSizing).toEqual({
        name: 300,
      });
    });

    it("two sizing updaters in the same tick compose", () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item: baseItem,
          allColumnIds: ["name", "service"],
          onChange,
        })
      );
      act(() => {
        result.current.setColumnSizing((prev) => ({ ...prev, name: 240 }));
        result.current.setColumnSizing((prev) => ({ ...prev, service: 100 }));
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          alertTable: expect.objectContaining({
            columnSizing: { name: 240, service: 100 },
          }),
        })
      );
    });

    it("setColumnOrder stores the order", () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item: baseItem,
          allColumnIds: ["name", "service"],
          onChange,
        })
      );
      act(() => result.current.setColumnOrder(["service", "name"]));
      expect(onChange.mock.calls[0][0].alertTable.columnOrder).toEqual([
        "service",
        "name",
      ]);
    });
  });

  describe("grouping", () => {
    it("reads the grouping from groupBy when the column exists", () => {
      const item = { ...baseItem, alertTable: { groupBy: "service" } };
      const { result } = renderHook(() =>
        useWidgetColumnState({ item, allColumnIds: ["name", "service"] })
      );
      expect(result.current.grouping).toEqual(["service"]);
    });

    it("ignores a groupBy whose column no longer exists", () => {
      const item = { ...baseItem, alertTable: { groupBy: "service" } };
      const { result } = renderHook(() =>
        useWidgetColumnState({ item, allColumnIds: ["name"] })
      );
      expect(result.current.grouping).toEqual([]);
    });

    it("clearing the grouping stores a null groupBy", () => {
      const onChange = jest.fn();
      const item = { ...baseItem, alertTable: { groupBy: "service" } };
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item,
          allColumnIds: ["name", "service"],
          onChange,
        })
      );
      act(() => result.current.setGrouping([]));
      expect(onChange.mock.calls[0][0].alertTable.groupBy).toBeNull();
    });

    it("clearing the grouping of a widget with no saved grouping emits nothing", () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item: baseItem,
          allColumnIds: ["name", "service"],
          onChange,
        })
      );
      act(() => result.current.setGrouping([]));
      expect(onChange).not.toHaveBeenCalled();
      expect(result.current.isCustomized).toBe(false);
    });

    it("choosing the grouping the widget already has emits nothing", () => {
      const onChange = jest.fn();
      const item = { ...baseItem, alertTable: { groupBy: "service" } };
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item,
          allColumnIds: ["name", "service"],
          onChange,
        })
      );
      act(() => result.current.setGrouping(["service"]));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("resolves a grouping updater against the current grouping", () => {
      const onChange = jest.fn();
      const item = { ...baseItem, alertTable: { groupBy: "service" } };
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item,
          allColumnIds: ["name", "service"],
          onChange,
        })
      );
      const updater = jest.fn(() => ["name"]);
      act(() => result.current.setGrouping(updater));
      expect(updater).toHaveBeenCalledWith(["service"]);
      expect(onChange.mock.calls[0][0].alertTable.groupBy).toBe("name");
    });

    it("keeps only the first column of a multi-column grouping", () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item: baseItem,
          allColumnIds: ["name", "service"],
          onChange,
        })
      );
      act(() => result.current.setGrouping(["service", "name"]));
      expect(onChange.mock.calls[0][0].alertTable.groupBy).toBe("service");
    });

    it("reads emptyGroupPosition from the widget", () => {
      const item = { ...baseItem, alertTable: { emptyGroupPosition: "bottom" as const } };
      const { result } = renderHook(() =>
        useWidgetColumnState({ item, allColumnIds: [] })
      );
      expect(result.current.emptyGroupPosition).toBe("bottom");
    });
  });

  describe("isCustomized", () => {
    it("is true when presetColumns is set", () => {
      const item = { ...baseItem, presetColumns: ["name"] };
      const { result } = renderHook(() =>
        useWidgetColumnState({ item, allColumnIds: ["name"] })
      );
      expect(result.current.isCustomized).toBe(true);
    });

    it("is true when alertTable has a key", () => {
      const item = { ...baseItem, alertTable: { groupBy: null } };
      const { result } = renderHook(() =>
        useWidgetColumnState({ item, allColumnIds: ["name"] })
      );
      expect(result.current.isCustomized).toBe(true);
    });

    it("is false for an empty alertTable", () => {
      const item = { ...baseItem, alertTable: {} };
      const { result } = renderHook(() =>
        useWidgetColumnState({ item, allColumnIds: ["name"] })
      );
      expect(result.current.isCustomized).toBe(false);
    });
  });

  describe("latest item", () => {
    it("builds the next change on the item the parent passes after a re-render", () => {
      const onChange = jest.fn();
      const { result, rerender } = renderHook(
        ({ item }) =>
          useWidgetColumnState({
            item,
            allColumnIds: ["name", "service"],
            onChange,
          }),
        { initialProps: { item: baseItem } }
      );
      rerender({
        item: { ...baseItem, alertTable: { groupBy: "service" } },
      });
      act(() => result.current.setEmptyGroupPosition("bottom"));
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          alertTable: { groupBy: "service", emptyGroupPosition: "bottom" },
        })
      );
    });

    it("drops the settings of a replaced item when the parent resets it", () => {
      const onChange = jest.fn();
      const customized = {
        ...baseItem,
        presetColumns: ["name"],
        alertTable: { groupBy: "service" },
      };
      const { result, rerender } = renderHook(
        ({ item }) =>
          useWidgetColumnState({
            item,
            allColumnIds: ["name", "service"],
            onChange,
          }),
        { initialProps: { item: customized as WidgetData } }
      );
      act(() => result.current.setEmptyGroupPosition("bottom"));
      rerender({ item: baseItem });
      act(() => result.current.setColumnOrder(["service", "name"]));
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          alertTable: { columnOrder: ["service", "name"] },
        })
      );
    });

    it("emits the item with its non-column fields intact", () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        useWidgetColumnState({
          item: baseItem,
          allColumnIds: ["name"],
          onChange,
        })
      );
      act(() => result.current.setEmptyGroupPosition("bottom"));
      expect(onChange.mock.calls[0][0]).toMatchObject({
        i: "w1",
        name: "Alerts",
        widgetType: WidgetType.PRESET,
      });
    });
  });
});
