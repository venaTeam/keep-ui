import React from "react";
import { render, screen } from "@testing-library/react";
import PresetAlertTablePanel from "../preset-alert-table-panel";
import { Preset } from "@/entities/presets/model/types";
import { PresetPanelType, WidgetData, WidgetType } from "../../../types";

const mockUsePresetAlertsCount = jest.fn();
const mockUsePresetAlertCount = jest.fn();
let mockLastTableBackground: string | undefined;

jest.mock("@/features/presets/custom-preset-links", () => ({
  usePresetAlertsCount: (...args: unknown[]) =>
    mockUsePresetAlertsCount(...args),
  usePresetAlertCount: (...args: unknown[]) => mockUsePresetAlertCount(...args),
}));

jest.mock("../widget-alerts-table", () => ({
  __esModule: true,
  default: ({ background }: { background?: string }) => {
    mockLastTableBackground = background;
    return <div data-testid="alerts-table" />;
  },
}));

const thresholds = [
  { value: 0, color: "#10b981" },
  { value: 10, color: "#dc2626" },
];

const buildItem = (overrides: Partial<WidgetData> = {}) =>
  ({
    i: "w1",
    x: 0,
    y: 0,
    w: 8,
    h: 6,
    name: "Prod Critical",
    widgetType: WidgetType.PRESET,
    preset: { id: "p1", name: "feed", countOfLastAlerts: 5 },
    presetPanelType: PresetPanelType.ALERT_TABLE,
    thresholds,
    ...overrides,
  }) as unknown as WidgetData;

const renderPanel = (item: WidgetData) =>
  render(
    <PresetAlertTablePanel
      item={item}
      preset={{ id: "p1", name: "feed" } as unknown as Preset}
      filterCel="severity == 'critical'"
    />
  );

const groupState = (state: {
  totalCount?: number;
  isLoading?: boolean;
  isError?: boolean;
}) =>
  mockUsePresetAlertCount.mockReturnValue({
    totalCount: 0,
    isLoading: false,
    isError: false,
    ...state,
  });

const incidents = { field: "incident", incidentStatus: "active" } as const;

beforeEach(() => {
  mockUsePresetAlertsCount.mockReset();
  mockUsePresetAlertCount.mockReset();
  mockLastTableBackground = undefined;
  mockUsePresetAlertsCount.mockReturnValue({
    alerts: [],
    totalCount: 120,
    isLoading: false,
  });
  groupState({});
});

describe("PresetAlertTablePanel without grouping", () => {
  it("renders today's header and does not request a grouped count", () => {
    const { container } = renderPanel(buildItem());

    expect(screen.getByText("showing 5 out of 120")).toBeInTheDocument();
    expect(
      container.querySelector('[data-cy="dashboard-widget-group-count"]')
    ).toBeNull();
    expect(mockUsePresetAlertCount).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
    expect(mockLastTableBackground).toBe("rgb(220, 38, 38, 0.1)");
  });
});

describe("PresetAlertTablePanel with grouping", () => {
  it("requests the grouped count and shows it above the alerts line", () => {
    groupState({ totalCount: 3 });
    const { container } = renderPanel(buildItem({ countBy: incidents }));

    expect(mockUsePresetAlertCount).toHaveBeenCalledWith(
      expect.objectContaining({
        groupBy: "incident",
        incidentStatus: "active",
        enabled: true,
      })
    );
    const line = container.querySelector(
      '[data-cy="dashboard-widget-group-count"]'
    );
    expect(line).toHaveTextContent("Active incidents:");
    expect(line).toHaveTextContent("3");
    expect(screen.getByText("showing 5 out of 120")).toBeInTheDocument();
  });

  it("makes the alerts line neutral and tints the table by the grouped count", () => {
    groupState({ totalCount: 3 });
    renderPanel(buildItem({ countBy: incidents }));

    expect(
      screen.getByText("showing 5 out of 120").parentElement
    ).toHaveClass("text-gray-500");
    expect(mockLastTableBackground).toBe("rgb(16, 185, 129, 0.1)");
  });

  it("uses the singular label at one", () => {
    groupState({ totalCount: 1 });
    const { container } = renderPanel(
      buildItem({ countBy: { field: "service" } })
    );

    expect(
      container.querySelector('[data-cy="dashboard-widget-group-count"]')
    ).toHaveTextContent("Service:");
  });

  it("shows a dash with an explanation when the grouped count fails", () => {
    groupState({ totalCount: 0, isError: true });
    const { container } = renderPanel(buildItem({ countBy: incidents }));

    const line = container.querySelector(
      '[data-cy="dashboard-widget-group-count"]'
    );
    expect(line).toHaveTextContent("—");
    expect(screen.getByTitle("Couldn't load count")).toBeInTheDocument();
    expect(line).not.toHaveTextContent(/\b0\b/);
  });

  it("shows a dash on a neutral tint when a refresh fails after an earlier success", () => {
    groupState({ totalCount: 5, isError: true });
    const { container } = renderPanel(buildItem({ countBy: incidents }));

    const line = container.querySelector(
      '[data-cy="dashboard-widget-group-count"]'
    );
    expect(line).toHaveTextContent("—");
    expect(line).not.toHaveTextContent("5");
    expect(screen.getByTitle("Couldn't load count")).toBeInTheDocument();
    expect(mockLastTableBackground).toBe("rgb(156, 163, 175, 0.1)");
  });

  it("does not tint the table until the grouped count has loaded", () => {
    groupState({ isLoading: true });
    renderPanel(buildItem({ countBy: incidents }));

    expect(mockLastTableBackground).toBeUndefined();
  });
});
