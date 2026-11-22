import React from "react";
import { render } from "@testing-library/react";
import PresetAlertTablePanel from "../preset-alert-table-panel";
import { Preset } from "@/entities/presets/model/types";
import { PresetPanelType, WidgetData, WidgetType } from "../../../types";

let mockTablePresetNoisy: boolean | undefined;

jest.mock("@/features/alerts/alert-quick-actions/ui/action-dialogs", () => ({
  ChangeStatusDialog: () => null,
  LinkIncidentDialog: () => null,
  DismissDialog: () => null,
}));

jest.mock("@/features/presets/custom-preset-links", () => ({
  usePresetAlertsCount: () => ({ alerts: [], totalCount: 3, isLoading: false }),
  usePresetAlertCount: () => ({
    totalCount: 0,
    isLoading: false,
    isError: false,
  }),
}));

jest.mock("../widget-alerts-table", () => ({
  __esModule: true,
  default: ({ presetNoisy }: { presetNoisy?: boolean }) => {
    mockTablePresetNoisy = presetNoisy;
    return <div data-testid="alerts-table" />;
  },
}));

const item = {
  i: "w1",
  x: 0,
  y: 0,
  w: 8,
  h: 6,
  name: "Noisy",
  widgetType: WidgetType.PRESET,
  preset: { id: "p1", name: "noisy", countOfLastAlerts: 5 },
  presetPanelType: PresetPanelType.ALERT_TABLE,
  thresholds: [],
} as unknown as WidgetData;

const renderPanel = (preset?: Partial<Preset>) =>
  render(
    <PresetAlertTablePanel
      item={item}
      preset={preset as Preset | undefined}
      filterCel=""
    />
  );

beforeEach(() => {
  mockTablePresetNoisy = undefined;
});

describe("PresetAlertTablePanel noisy preset", () => {
  it("tells the table its preset is noisy", () => {
    renderPanel({ id: "p1", name: "noisy", is_noisy: true });
    expect(mockTablePresetNoisy).toBe(true);
  });

  it.each<[string, Partial<Preset> | undefined]>([
    ["a quiet preset", { id: "p1", name: "noisy", is_noisy: false }],
    ["a preset without the flag", { id: "p1", name: "noisy" }],
    ["no preset", undefined],
  ])("tells the table it is not noisy for %s", (_name, preset) => {
    renderPanel(preset);
    expect(mockTablePresetNoisy).toBe(false);
  });
});
