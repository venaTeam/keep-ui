import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GridItem from "../GridItem";
import { PresetPanelType, WidgetData, WidgetType } from "../types";

jest.mock("../MenuButton", () => ({
  __esModule: true,
  default: ({ onSave }: { onSave: () => void }) => (
    <button onClick={onSave}>header-save</button>
  ),
}));

jest.mock("../widget-types/preset/preset-grid-item", () => ({
  __esModule: true,
  default: () => <div data-testid="preset-grid-item" />,
}));

jest.mock("../widget-types/metric/metric-grid-item", () => ({
  __esModule: true,
  default: () => <div data-testid="metric-grid-item" />,
}));

jest.mock("../widget-types/generic-metrics/generic-metrics-grid-item", () => ({
  __esModule: true,
  default: () => <div data-testid="generic-metrics-grid-item" />,
}));

jest.mock("../widget-types/service-now/widget-service-now", () => ({
  __esModule: true,
  default: () => <div data-testid="service-now" />,
}));

const baseItem = (overrides: Partial<WidgetData> = {}): WidgetData =>
  ({
    i: "w1",
    x: 0,
    y: 0,
    w: 4,
    h: 4,
    name: "My Alerts",
    widgetType: WidgetType.PRESET,
    preset: { id: "p1", name: "feed" },
    presetPanelType: PresetPanelType.ALERT_TABLE,
    ...overrides,
  }) as unknown as WidgetData;

const renderItem = (item: WidgetData, props: { isDraggable?: boolean } = {}) =>
  render(
    <GridItem
      item={item}
      onEdit={jest.fn()}
      onDelete={jest.fn()}
      onSave={jest.fn()}
      {...props}
    />
  );

describe("GridItem drag handle", () => {
  it("renders a drag grip with the grid handle class when draggable", () => {
    const { container } = renderItem(baseItem(), { isDraggable: true });
    const grip = container.querySelector('[data-cy="dashboard-widget-drag-handle"]');
    expect(grip).toBeInTheDocument();
    expect(grip).toHaveClass("grid-item__widget");
  });

  it("gives counter widgets a drag handle even though their header is hidden", () => {
    const { container } = renderItem(
      baseItem({ presetPanelType: PresetPanelType.ALERT_COUNT_PANEL }),
      { isDraggable: true }
    );
    expect(container.querySelector('[data-cy="dashboard-widget-title"]')).toBeNull();
    expect(container.querySelectorAll(".grid-item__widget")).toHaveLength(1);
  });

  it("keeps the title as a drag handle for non-counter widgets", () => {
    const { container } = renderItem(baseItem(), { isDraggable: true });
    expect(container.querySelector('[data-cy="dashboard-widget-title"]')).toHaveClass(
      "grid-item__widget"
    );
  });

  it("hides the grip when dragging is disabled", () => {
    const { container } = renderItem(baseItem(), { isDraggable: false });
    expect(container.querySelector('[data-cy="dashboard-widget-drag-handle"]')).toBeNull();
  });
});

describe("GridItem menu save", () => {
  it("saves the latest item after the item prop changes", () => {
    const onSave = jest.fn();
    const original = baseItem({ name: "Before edit" });
    const { rerender } = render(
      <GridItem item={original} onEdit={jest.fn()} onDelete={jest.fn()} onSave={onSave} />
    );

    const edited = baseItem({ name: "After edit" });
    rerender(
      <GridItem item={edited} onEdit={jest.fn()} onDelete={jest.fn()} onSave={onSave} />
    );

    fireEvent.click(screen.getByText("header-save"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "After edit" }));
  });
});
