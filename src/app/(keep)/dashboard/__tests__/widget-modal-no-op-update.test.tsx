import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import WidgetModal from "../WidgetModal";
import { dashboardEditKey } from "../dashboard-edit-state";
import { PresetPanelType, WidgetData, WidgetType } from "../types";
import { Preset } from "@/entities/presets/model/types";

jest.mock("@/utils/hooks/useProviders", () => ({
  useProviders: () => ({ data: undefined }),
}));

jest.mock("@/features/filter/hooks", () => ({
  ...jest.requireActual("@/features/filter/hooks"),
  useFacetPotentialFields: () => ({ data: ["service", "labels.team"] }),
}));

const preset = {
  id: "p1",
  name: "feed",
  options: [],
  is_private: false,
  is_noisy: false,
  tags: [],
} as unknown as Preset;

const olderWidget = {
  i: "w1",
  x: 0,
  y: 0,
  w: 8,
  h: 6,
  static: false,
  name: "Feed",
  widgetType: WidgetType.PRESET,
  preset: { ...preset, countOfLastAlerts: 5 },
  thresholds: [
    { value: 0, color: "#10b981" },
    { value: 20, color: "#dc2626" },
  ],
} as unknown as WidgetData;

const formSavedWidget = {
  ...olderWidget,
  presetColumns: [
    "severity",
    "status",
    "source",
    "name",
    "description",
    "lastReceived",
  ],
  presetPanelType: PresetPanelType.ALERT_TABLE,
  showFiringOnly: false,
  customLink: "",
} as WidgetData;

const renderModal = (item: WidgetData) => {
  const onEditWidget = jest.fn();
  render(
    <WidgetModal
      isOpen
      onClose={jest.fn()}
      onAddWidget={jest.fn()}
      onEditWidget={onEditWidget}
      presets={[preset]}
      editingItem={item}
      metricWidgets={[]}
    />
  );
  return onEditWidget;
};

const submit = async (onEditWidget: jest.Mock): Promise<WidgetData> => {
  const button = await screen.findByRole("button", { name: "Update Widget" });
  await waitFor(() => expect(button).not.toBeDisabled());
  await act(async () => {
    fireEvent.click(button);
  });
  await waitFor(() => expect(onEditWidget).toHaveBeenCalledTimes(1));
  return onEditWidget.mock.calls[0][0];
};

const editKey = (item: WidgetData) =>
  dashboardEditKey({
    layout: [],
    widgetData: [item],
    dashboardName: "Ops",
  } as unknown as Parameters<typeof dashboardEditKey>[0]);

describe("Edit Widget, then Update with no changes", () => {
  it.each<[string, WidgetData]>([
    [
      "grouped from the settings panel or a header ({groupBy} only)",
      { ...formSavedWidget, alertTable: { groupBy: "service" } },
    ],
    [
      "grouped with an explicit 'top'",
      {
        ...formSavedWidget,
        alertTable: { groupBy: "service", emptyGroupPosition: "top" },
      },
    ],
    [
      "grouped with 'bottom'",
      {
        ...formSavedWidget,
        alertTable: { groupBy: "service", emptyGroupPosition: "bottom" },
      },
    ],
    ["ungrouped", formSavedWidget],
    [
      "customized (columns, renames, widths, order)",
      {
        ...formSavedWidget,
        presetColumns: ["name", "service", "description"],
        alertTable: {
          columnRenameMapping: { name: "Alert" },
          columnSizing: { name: 240 },
          columnOrder: ["service", "name", "description"],
        },
      },
    ],
    [
      "saved before presetColumns, presetPanelType, showFiringOnly and customLink existed",
      olderWidget,
    ],
    [
      "grouped first, then reordered ({groupBy, columnOrder})",
      {
        ...formSavedWidget,
        alertTable: {
          groupBy: "service",
          columnOrder: ["service", "name", "description"],
        },
      },
    ],
    [
      "grouped first, then resized ({groupBy, columnSizing})",
      {
        ...formSavedWidget,
        alertTable: { groupBy: "service", columnSizing: { name: 240 } },
      },
    ],
    [
      "grouped first with 'bottom', then renamed ({groupBy, emptyGroupPosition, columnRenameMapping})",
      {
        ...formSavedWidget,
        alertTable: {
          groupBy: "service",
          emptyGroupPosition: "bottom",
          columnRenameMapping: { name: "Alert" },
        },
      },
    ],
    [
      "renamed first, then grouped ({columnRenameMapping, groupBy})",
      {
        ...formSavedWidget,
        alertTable: {
          columnRenameMapping: { name: "Alert" },
          groupBy: "service",
        },
      },
    ],
    [
      "whose saved keys come in another order",
      {
        i: "w1",
        alertTable: { groupBy: "service", columnSizing: { name: 240 } },
        customLink: "",
        showFiringOnly: false,
        presetPanelType: PresetPanelType.ALERT_TABLE,
        presetColumns: ["name", "description"],
        thresholds: olderWidget.thresholds,
        preset: olderWidget.preset,
        widgetType: WidgetType.PRESET,
        name: "Feed",
        x: 0,
        y: 0,
        w: 8,
        h: 6,
        static: false,
      } as unknown as WidgetData,
    ],
  ])("leaves a widget %s unchanged", async (_shape, item) => {
    const updated = await submit(renderModal(item));

    expect(updated).toEqual(item);
    expect(editKey(updated)).toBe(editKey(item));
  });
});

describe("Edit Widget, then change Rows with no value", () => {
  it("writes bottom chosen for a widget grouped from the settings panel", async () => {
    const onEditWidget = renderModal({
      ...formSavedWidget,
      alertTable: { groupBy: "service" },
    });
    fireEvent.click(await screen.findByRole("radio", { name: "Bottom" }));

    const updated = await submit(onEditWidget);

    expect(updated.alertTable).toEqual({
      groupBy: "service",
      emptyGroupPosition: "bottom",
    });
  });

  it("writes top chosen for a widget saved with bottom", async () => {
    const onEditWidget = renderModal({
      ...formSavedWidget,
      alertTable: { groupBy: "service", emptyGroupPosition: "bottom" },
    });
    fireEvent.click(await screen.findByRole("radio", { name: "Top" }));

    const updated = await submit(onEditWidget);

    expect(updated.alertTable).toEqual({
      groupBy: "service",
      emptyGroupPosition: "top",
    });
  });
});
