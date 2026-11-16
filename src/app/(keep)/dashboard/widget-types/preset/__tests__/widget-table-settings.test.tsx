import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  WidgetColumnWidths,
  WidgetTableSettings,
} from "../widget-table-settings";
import { WidgetColumnState } from "../use-widget-column-state";
import {
  mergeVisibleColumnOrder,
  toVisibilityState,
} from "../alert-table-widget-config";

const mockGetAutofitColumnWidth = jest.fn();

jest.mock("@/features/filter/hooks", () => ({
  useFacetPotentialFields: () => ({
    data: ["labels.region", "labels.team", "name", "checkbox"],
  }),
}));

jest.mock("@/widgets/alerts-table/lib/column-autofit", () => ({
  getAutofitColumnWidth: (...args: unknown[]) =>
    mockGetAutofitColumnWidth(...args),
}));

const COLUMN_ORDER = [
  "description",
  "severity",
  "name",
  "status",
  "environment",
  "source",
  "lastReceived",
  "assignee",
];
const VISIBLE = ["name", "description", "severity", "status", "source"];

const makeState = (
  overrides: Partial<WidgetColumnState> = {}
): WidgetColumnState => {
  const columnOrder = overrides.columnOrder ?? COLUMN_ORDER;
  const visibleColumns = overrides.visibleColumns ?? VISIBLE;
  return {
    columnOrder,
    visibleColumns,
    columnVisibility: toVisibilityState(visibleColumns, columnOrder),
    columnRenameMapping: {},
    columnSizing: {},
    grouping: [],
    emptyGroupPosition: "top",
    isCustomized: false,
    canEdit: true,
    setColumnOrder: jest.fn(),
    setColumnVisibility: jest.fn(),
    setVisibleColumns: jest.fn(),
    setColumnRenameMapping: jest.fn(),
    setColumnSizing: jest.fn(),
    setGrouping: jest.fn(),
    setEmptyGroupPosition: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  };
};

const TABLE_ELEMENT = document.createElement("table");

const makeWidths = (): WidgetColumnWidths => ({
  columns: {
    severity: { width: 2, min: 20, max: 2 },
    status: { width: 36, min: 36, max: 36 },
    source: { width: 44, min: 44, max: 44 },
    name: { width: 180, min: 100, max: 600 },
    description: { width: 420, min: 100, max: 800 },
  },
  tableRef: { current: TABLE_ELEMENT },
});

const renderSettings = (
  overrides: Partial<WidgetColumnState> = {},
  columnWidths: WidgetColumnWidths = makeWidths()
) => {
  const state = makeState(overrides);
  const utils = render(
    <WidgetTableSettings
      state={state}
      columnIds={state.columnOrder}
      columnWidths={columnWidths}
    />
  );
  return { state, ...utils };
};

const settingsButton = () =>
  document.querySelector(
    '[data-cy="dashboard-widget-table-settings-btn"]'
  ) as HTMLElement;

const panel = () =>
  document.querySelector(
    '[data-cy="dashboard-widget-table-settings"]'
  ) as HTMLElement | null;

const openSettings = () => {
  fireEvent.click(settingsButton());
  return panel() as HTMLElement;
};

const listedColumnIds = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-table-settings-column]")
  ).map((row) => row.dataset.tableSettingsColumn);

const clickLikeAPointer = (element: Element) => {
  fireEvent.pointerDown(element);
  fireEvent.mouseDown(element);
  fireEvent.pointerUp(element);
  fireEvent.mouseUp(element);
  fireEvent.click(element);
};

beforeEach(() => {
  mockGetAutofitColumnWidth.mockReset();
});

describe("WidgetTableSettings", () => {
  it("opens a 'Table settings' popover from the ⚙ button", () => {
    renderSettings();

    expect(panel()).toBeNull();
    const opened = openSettings();

    expect(opened).toBeInTheDocument();
    expect(within(opened).getByText("Table settings")).toBeInTheDocument();
    expect(within(opened).getByText("Columns")).toBeInTheDocument();
    expect(within(opened).getByText("Group rows by")).toBeInTheDocument();
  });

  it("the popover is a dialog named 'Table settings'", () => {
    renderSettings();

    const opened = openSettings();

    expect(screen.getByRole("dialog", { name: "Table settings" })).toBe(opened);
  });

  it("renders the popover in a portal above the page", () => {
    const { container } = renderSettings();

    const opened = openSettings();

    expect(container).not.toContainElement(opened);
    expect(opened).toHaveClass("z-50");
  });

  it("lists visible columns first in display order, then hidden ones", () => {
    renderSettings();
    openSettings();

    expect(listedColumnIds()).toEqual([
      "severity",
      "status",
      "source",
      "description",
      "name",
      "environment",
      "lastReceived",
      "assignee",
    ]);
    expect(screen.getByRole("checkbox", { name: "Description" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Environment" })
    ).not.toBeChecked();
  });

  it("pinned icon columns have a checkbox but no drag handle and no rename", () => {
    renderSettings();
    openSettings();

    const severity = document.querySelector(
      '[data-table-settings-column="severity"]'
    ) as HTMLElement;
    expect(within(severity).getByRole("checkbox")).toBeChecked();
    expect(
      within(severity).queryByRole("button", { name: /Reorder/ })
    ).toBeNull();
    expect(
      within(severity).queryByRole("button", { name: /Rename/ })
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Reorder Description" })
    ).toBeInTheDocument();
  });

  it("unchecking a column calls setVisibleColumns without it", () => {
    const { state } = renderSettings();
    openSettings();

    fireEvent.click(screen.getByRole("checkbox", { name: "Description" }));

    expect(state.setVisibleColumns).toHaveBeenCalledTimes(1);
    expect(state.setVisibleColumns).toHaveBeenCalledWith([
      "name",
      "severity",
      "status",
      "source",
    ]);
  });

  it("checking a hidden column appends it to the visible columns", () => {
    const { state } = renderSettings();
    openSettings();

    fireEvent.click(screen.getByRole("checkbox", { name: "Assignee" }));

    expect(state.setVisibleColumns).toHaveBeenCalledWith([
      ...VISIBLE,
      "assignee",
    ]);
  });

  it("renaming inline calls setColumnRenameMapping with the new name", () => {
    const { state } = renderSettings({
      columnRenameMapping: { name: "Title" },
    });
    openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Rename Description" }));
    const input = screen.getByRole("textbox", { name: "Name for Description" });
    expect(input).toHaveValue("Description");
    fireEvent.change(input, { target: { value: "  Details  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(state.setColumnRenameMapping).toHaveBeenCalledTimes(1);
    expect(state.setColumnRenameMapping).toHaveBeenCalledWith({
      name: "Title",
      description: "Details",
    });
    expect(
      screen.queryByRole("textbox", { name: "Name for Description" })
    ).toBeNull();
  });

  it("shows a renamed column with its field id", () => {
    renderSettings({ columnRenameMapping: { description: "Details" } });
    openSettings();

    expect(
      screen.getByRole("checkbox", { name: "Details (description)" })
    ).toBeInTheDocument();
  });

  it("clearing a rename removes it; an unchanged name or Escape emits nothing", () => {
    const { state } = renderSettings({
      columnRenameMapping: { description: "Details" },
    });
    const opened = openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Rename Details" }));
    let input = screen.getByRole("textbox", { name: "Name for Details" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(state.setColumnRenameMapping).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Rename Details" }));
    input = screen.getByRole("textbox", { name: "Name for Details" });
    fireEvent.change(input, { target: { value: "Other" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(state.setColumnRenameMapping).not.toHaveBeenCalled();
    expect(opened).toBeInTheDocument();
    expect(panel()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Rename Details" }));
    input = screen.getByRole("textbox", { name: "Name for Details" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(state.setColumnRenameMapping).toHaveBeenCalledWith({});
  });

  describe("reordering", () => {
    const ROW_HEIGHT = 30;
    let rectSpy: jest.SpyInstance;

    beforeEach(() => {
      rectSpy = jest
        .spyOn(Element.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: Element) {
          const rows = Array.from(
            document.querySelectorAll("[data-table-settings-column]")
          );
          const index = rows.indexOf(
            this.closest("[data-table-settings-column]") as Element
          );
          const top = index === -1 ? 0 : index * ROW_HEIGHT;
          const height = index === -1 ? 0 : ROW_HEIGHT;
          return {
            x: 0,
            y: top,
            top,
            left: 0,
            right: 200,
            bottom: top + height,
            width: index === -1 ? 0 : 200,
            height,
            toJSON: () => ({}),
          } as DOMRect;
        });
    });

    afterEach(() => rectSpy.mockRestore());

    const flush = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

    it("reordering with the keyboard sensor calls setColumnOrder", async () => {
      const { state } = renderSettings();
      openSettings();

      const handle = screen.getByRole("button", {
        name: "Reorder Description",
      });
      act(() => handle.focus());
      fireEvent.keyDown(handle, { code: "Space", key: " " });
      await flush();
      fireEvent.keyDown(document, { code: "ArrowDown", key: "ArrowDown" });
      await flush();
      fireEvent.keyDown(document, { code: "Space", key: " " });
      await flush();

      expect(state.setColumnOrder).toHaveBeenCalledTimes(1);
      const order = (state.setColumnOrder as jest.Mock).mock.calls[0][0];
      expect(order).toEqual(
        mergeVisibleColumnOrder(COLUMN_ORDER, ["name", "description"])
      );
      expect(order).toEqual([
        "name",
        "severity",
        "description",
        "status",
        "environment",
        "source",
        "lastReceived",
        "assignee",
      ]);
    });

    it("announces the reorder with the columns' labels, not their ids", async () => {
      renderSettings({ columnRenameMapping: { description: "Details" } });
      openSettings();
      const announced: string[] = [];
      const observer = new MutationObserver(() => {
        const text = document.querySelector('[id^="DndLiveRegion"]')
          ?.textContent;
        if (text && announced[announced.length - 1] !== text) {
          announced.push(text);
        }
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      });

      const handle = screen.getByRole("button", { name: "Reorder Details" });
      act(() => handle.focus());
      fireEvent.keyDown(handle, { code: "Space", key: " " });
      await flush();
      fireEvent.keyDown(document, { code: "ArrowDown", key: "ArrowDown" });
      await flush();
      fireEvent.keyDown(document, { code: "Space", key: " " });
      await flush();
      observer.disconnect();

      expect(announced).toEqual(
        expect.arrayContaining([
          "Column Details was moved over Alert name.",
          "Column Details was dropped over Alert name.",
        ])
      );
      announced.forEach((text) =>
        expect(text).not.toMatch(/description|draggable/i)
      );
    });
  });

  it("search adds a field as a visible column", () => {
    const { state } = renderSettings();
    openSettings();

    fireEvent.change(screen.getByRole("searchbox", { name: "Find a field" }), {
      target: { value: "region" },
    });
    fireEvent.click(screen.getByRole("button", { name: "labels.region" }));

    expect(state.setVisibleColumns).toHaveBeenCalledWith([
      ...VISIBLE,
      "labels.region",
    ]);
    expect(screen.getByRole("searchbox", { name: "Find a field" })).toHaveValue(
      ""
    );
  });

  it("search offers facet, enrichment and hidden widget fields, never visible or row-chrome ones", () => {
    renderSettings();
    openSettings();
    const search = screen.getByRole("searchbox", { name: "Find a field" });

    fireEvent.change(search, { target: { value: "e" } });
    const results = within(
      screen.getByRole("list", { name: "Matching fields" })
    )
      .getAllByRole("button")
      .map((button) => button.textContent);

    expect(results).toEqual(
      expect.arrayContaining([
        "labels.team",
        "environment",
        "lastReceived",
        "assignee",
        "ticket_type",
      ])
    );
    expect(results).not.toContain("name");
    expect(results).not.toContain("description");
    expect(results).not.toContain("severity");

    fireEvent.change(search, { target: { value: "checkbox" } });
    expect(screen.getByText("No matching fields")).toBeInTheDocument();
  });

  it("'Rows with no value' shows only when grouped and calls setEmptyGroupPosition", () => {
    const { state, unmount } = renderSettings();
    openSettings();
    expect(screen.queryByText("Rows with no value")).toBeNull();
    unmount();

    const grouped = renderSettings({ grouping: ["service"] });
    openSettings();
    expect(screen.getByText("Rows with no value")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Top" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Bottom" }));

    expect(grouped.state.setEmptyGroupPosition).toHaveBeenCalledWith("bottom");
    expect(state.setEmptyGroupPosition).not.toHaveBeenCalled();
  });

  it("Reset to defaults calls reset and is disabled when not customized", () => {
    const { unmount } = renderSettings();
    openSettings();
    expect(
      screen.getByRole("button", { name: "Reset to defaults" })
    ).toBeDisabled();
    expect(screen.queryByText("Customized for this widget")).toBeNull();
    unmount();

    const { state } = renderSettings({ isCustomized: true });
    openSettings();
    expect(screen.getByText("Customized for this widget")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    expect(state.reset).toHaveBeenCalledTimes(1);
    expect(state.setVisibleColumns).not.toHaveBeenCalled();
    expect(state.setColumnOrder).not.toHaveBeenCalled();
  });

  describe("column widths", () => {
    const openWidth = (label: string) => {
      fireEvent.click(
        screen.getByRole("button", { name: `Edit ${label} width` })
      );
      return screen.getByRole("spinbutton", { name: `${label} width` });
    };

    it("offers width controls only on visible, unpinned columns", () => {
      renderSettings();
      openSettings();

      ["Alert name", "Description"].forEach((label) =>
        expect(
          screen.getByRole("button", { name: `Edit ${label} width` })
        ).toBeInTheDocument()
      );
      ["severity", "status", "source", "environment", "assignee"].forEach(
        (id) => {
          const row = document.querySelector(
            `[data-table-settings-column="${id}"]`
          ) as HTMLElement;
          expect(
            within(row).queryByRole("button", { name: /width/ })
          ).toBeNull();
          expect(within(row).queryByRole("spinbutton")).toBeNull();
        }
      );
    });

    it("shows the column's current width and keeps the editor closed until asked", () => {
      renderSettings();
      openSettings();

      expect(screen.queryByRole("spinbutton")).toBeNull();
      const toggle = screen.getByRole("button", {
        name: "Edit Description width",
      });
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      const input = openWidth("Description");

      expect(input).toHaveValue(420);
      expect(input).toHaveAttribute("min", "100");
      expect(input).toHaveAttribute("max", "800");
      expect(toggle).toHaveAttribute("aria-expanded", "true");
    });

    it("commits a typed width once on Enter, clamped, as the full sizing map", () => {
      const { state } = renderSettings({ columnSizing: { description: 300 } });
      openSettings();
      const input = openWidth("Alert name");

      fireEvent.change(input, { target: { value: "9" } });
      fireEvent.change(input, { target: { value: "90" } });
      fireEvent.change(input, { target: { value: "9000" } });
      expect(state.setColumnSizing).not.toHaveBeenCalled();

      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.blur(input);

      expect(state.setColumnSizing).toHaveBeenCalledTimes(1);
      expect(state.setColumnSizing).toHaveBeenCalledWith({
        description: 300,
        name: 600,
      });
    });

    it("commits on blur and clamps up to the minimum", () => {
      const { state } = renderSettings();
      openSettings();
      const input = openWidth("Alert name");

      fireEvent.change(input, { target: { value: "12" } });
      fireEvent.blur(input);

      expect(state.setColumnSizing).toHaveBeenCalledTimes(1);
      expect(state.setColumnSizing).toHaveBeenCalledWith({ name: 100 });
    });

    it("emits nothing for an untouched, unchanged, empty or cancelled width", () => {
      const { state } = renderSettings({ columnSizing: { name: 240 } });
      const opened = openSettings();
      const input = openWidth("Alert name");

      fireEvent.blur(input);
      fireEvent.change(input, { target: { value: "240" } });
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.blur(input);
      fireEvent.change(input, { target: { value: "300" } });
      fireEvent.keyDown(input, { key: "Escape" });
      fireEvent.blur(input);

      expect(state.setColumnSizing).not.toHaveBeenCalled();
      expect(input).toHaveValue(180);
      expect(opened).toBeInTheDocument();
      expect(panel()).not.toBeNull();
    });

    it("Auto-fit measures the widget's table and saves the width", () => {
      mockGetAutofitColumnWidth.mockReturnValue(275);
      const { state } = renderSettings({ columnSizing: { name: 240 } });
      openSettings();
      openWidth("Description");

      fireEvent.click(
        screen.getByRole("button", { name: "Auto-fit Description" })
      );

      expect(mockGetAutofitColumnWidth).toHaveBeenCalledWith(
        TABLE_ELEMENT,
        "description",
        { minSize: 100, maxSize: 800 }
      );
      expect(state.setColumnSizing).toHaveBeenCalledTimes(1);
      expect(state.setColumnSizing).toHaveBeenCalledWith({
        name: 240,
        description: 275,
      });
    });

    it("Auto-fit with nothing to measure emits nothing", () => {
      mockGetAutofitColumnWidth.mockReturnValue(null);
      const { state } = renderSettings();
      openSettings();
      openWidth("Description");

      fireEvent.click(
        screen.getByRole("button", { name: "Auto-fit Description" })
      );

      expect(state.setColumnSizing).not.toHaveBeenCalled();
    });

    it("Reset width shows only for a saved width and removes it", () => {
      const { state } = renderSettings({
        columnSizing: { name: 240, description: 300 },
      });
      openSettings();

      openWidth("Alert name");
      fireEvent.click(
        screen.getByRole("button", { name: "Reset Alert name width" })
      );
      expect(state.setColumnSizing).toHaveBeenCalledTimes(1);
      expect(state.setColumnSizing).toHaveBeenCalledWith({ description: 300 });

      cleanup();
      renderSettings({ columnSizing: { description: 300 } });
      openSettings();
      openWidth("Alert name");
      expect(
        screen.queryByRole("button", { name: "Reset Alert name width" })
      ).toBeNull();
    });

    it("opens one width editor at a time", () => {
      renderSettings();
      openSettings();

      openWidth("Alert name");
      openWidth("Description");

      expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
      expect(
        screen.getByRole("spinbutton", { name: "Description width" })
      ).toBeInTheDocument();
    });
  });

  describe("Group rows by inside the popover", () => {
    const openGroupBy = async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Show Group rows by options" })
      );
      return screen.findByRole("listbox");
    };

    it("choosing an option applies it and keeps the popover open", async () => {
      const { state } = renderSettings();
      openSettings();

      const listbox = await openGroupBy();
      expect(panel()).not.toContainElement(listbox);
      clickLikeAPointer(
        within(listbox).getByRole("option", { name: "Service" })
      );

      expect(state.setGrouping).toHaveBeenCalledWith(["service"]);
      expect(panel()).not.toBeNull();
    });

    it("clicking a non-option inside the listbox keeps the popover open", async () => {
      renderSettings();
      openSettings();

      const listbox = await openGroupBy();
      clickLikeAPointer(within(listbox).getByText("Any other field…"));

      expect(panel()).not.toBeNull();
    });

    it("the same click outside the popover closes it", async () => {
      renderSettings();
      openSettings();

      clickLikeAPointer(document.body);

      expect(panel()).toBeNull();
    });

    it("offers facet and widget fields under 'Any other field…' and None clears", async () => {
      const { state } = renderSettings({ grouping: ["service"] });
      openSettings();

      const listbox = await openGroupBy();
      const others = within(listbox).getByRole("group", {
        name: "Any other field…",
      });
      const otherIds = within(others)
        .getAllByRole("option")
        .map((option) => option.textContent);
      expect(otherIds).toEqual(
        expect.arrayContaining(["labels.region", "environment", "ticket_id"])
      );
      expect(otherIds).not.toContain("checkbox");

      clickLikeAPointer(within(listbox).getByRole("option", { name: "None" }));
      expect(state.setGrouping).toHaveBeenCalledWith([]);
    });

    it("offers only the fields isGroupable accepts, shortlist included", async () => {
      const state = makeState();
      render(
        <WidgetTableSettings
          state={state}
          columnIds={state.columnOrder}
          columnWidths={makeWidths()}
          isGroupable={(id) => !["severity", "extraPayload", "status"].includes(id)}
        />
      );
      openSettings();

      const listbox = await openGroupBy();
      expect(
        within(listbox).queryByRole("option", { name: "severity" })
      ).toBeNull();
      expect(
        within(listbox).queryByRole("option", { name: "Status" })
      ).toBeNull();
      expect(
        within(listbox).getByRole("option", { name: "environment" })
      ).toBeInTheDocument();
    });
  });

  it("closes from the ✕ button", () => {
    renderSettings();
    openSettings();

    fireEvent.click(
      screen.getByRole("button", { name: "Close table settings" })
    );

    expect(panel()).toBeNull();
  });
});
