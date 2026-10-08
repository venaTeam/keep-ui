import React from "react";
import { render, screen } from "@testing-library/react";
import PresetGridItem from "../preset-grid-item";
import { PresetPanelType, WidgetData, WidgetType } from "../../../types";

const mockCountPanel = jest.fn();

jest.mock("../widget-alert-count-panel", () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockCountPanel(props);
    return <div data-testid="count-panel" />;
  },
}));

jest.mock("../preset-alert-table-panel", () => ({
  __esModule: true,
  default: () => <div data-testid="table-panel" />,
}));

jest.mock("@/utils/hooks/useDashboardPresets", () => ({
  useDashboardPreset: () => [{ id: "p1", name: "feed", options: [] }],
}));

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "ops" }),
  useSearchParams: () => new URLSearchParams(),
}));

const buildItem = (overrides: Partial<WidgetData>) =>
  ({
    i: "w1",
    x: 0,
    y: 0,
    w: 4,
    h: 4,
    name: "Prod Critical",
    widgetType: WidgetType.PRESET,
    preset: { id: "p1", name: "feed" },
    ...overrides,
  }) as unknown as WidgetData;

beforeEach(() => mockCountPanel.mockClear());

describe("PresetGridItem", () => {
  it("passes countBy to the counter tile", () => {
    const countBy = { field: "incident", incidentStatus: "firing" } as const;
    render(
      <PresetGridItem
        item={buildItem({
          presetPanelType: PresetPanelType.ALERT_COUNT_PANEL,
          countBy,
        })}
      />
    );

    expect(screen.getByTestId("count-panel")).toBeInTheDocument();
    expect(mockCountPanel).toHaveBeenCalledWith(
      expect.objectContaining({ countBy })
    );
  });

  it("renders the table panel for table widgets", () => {
    render(
      <PresetGridItem
        item={buildItem({ presetPanelType: PresetPanelType.ALERT_TABLE })}
      />
    );

    expect(screen.getByTestId("table-panel")).toBeInTheDocument();
    expect(mockCountPanel).not.toHaveBeenCalled();
  });
});
