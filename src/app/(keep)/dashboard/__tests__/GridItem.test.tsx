import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GridItem from "../GridItem";
import { DashboardEditModeProvider } from "../DashboardEditModeContext";
import { PresetPanelType, WidgetData, WidgetType } from "../types";

jest.mock("../MenuButton", () => ({
  __esModule: true,
  default: ({ onEdit }: { onEdit: () => void }) => (
    <button onClick={onEdit}>widget-menu</button>
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
  default: ({ onEdit }: { onEdit: (item: unknown) => void }) => (
    <button onClick={() => onEdit({ i: "w1", changed: true })}>
      change-filters
    </button>
  ),
}));

jest.mock("../widget-types/service-now/widget-service-now", () => ({
  __esModule: true,
  default: () => <div data-testid="service-now" />,
}));

jest.mock("../widget-types/incident-table/incident-table-grid-item", () => ({
  __esModule: true,
  default: () => <div data-testid="incident-table-grid-item" />,
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

const renderItem = (
  item: WidgetData,
  { isEditMode = true, ...props }: { isDraggable?: boolean; isEditMode?: boolean } = {}
) =>
  render(
    <DashboardEditModeProvider value={isEditMode}>
      <GridItem
        item={item}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onSave={jest.fn()}
        {...props}
      />
    </DashboardEditModeProvider>
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

describe("GridItem menu edit", () => {
  it("edits the latest item after the item prop changes", () => {
    const onEdit = jest.fn();
    const original = baseItem({ name: "Before edit" });
    const { rerender } = render(
      <DashboardEditModeProvider value={true}>
        <GridItem item={original} onEdit={onEdit} onDelete={jest.fn()} onSave={jest.fn()} />
      </DashboardEditModeProvider>
    );

    const edited = baseItem({ name: "After edit" });
    rerender(
      <DashboardEditModeProvider value={true}>
        <GridItem item={edited} onEdit={onEdit} onDelete={jest.fn()} onSave={jest.fn()} />
      </DashboardEditModeProvider>
    );

    fireEvent.click(screen.getByText("widget-menu"));
    expect(onEdit).toHaveBeenCalledWith(
      "w1",
      expect.objectContaining({ name: "After edit" })
    );
  });
});

describe("GridItem incident table", () => {
  it("renders the incident table for an incident table widget", () => {
    renderItem(
      baseItem({
        widgetType: WidgetType.INCIDENT_TABLE,
        preset: undefined,
        presetPanelType: undefined,
        name: "Open incidents",
      })
    );

    expect(screen.getByTestId("incident-table-grid-item")).toBeInTheDocument();
    expect(screen.getByText("Open incidents")).toBeInTheDocument();
  });

  it("does not render it for other widgets", () => {
    renderItem(baseItem());

    expect(screen.queryByTestId("incident-table-grid-item")).toBeNull();
  });
});

describe("GridItem edit mode", () => {
  const widgetBody = (container: HTMLElement) =>
    container.querySelector('[data-cy="dashboard-widget-body"]');

  it("hides the panel menu in view mode", () => {
    renderItem(baseItem(), { isEditMode: false });
    expect(screen.queryByText("widget-menu")).toBeNull();
    expect(screen.getByText("My Alerts")).toBeInTheDocument();
  });

  it("shows the panel menu in edit mode", () => {
    renderItem(baseItem(), { isEditMode: true });
    expect(screen.getByText("widget-menu")).toBeInTheDocument();
  });

  it("leaves panel content interactive in view mode", () => {
    const { container } = renderItem(baseItem(), { isEditMode: false });
    expect(widgetBody(container)).not.toHaveAttribute("inert");
  });

  it("makes panel content inert in edit mode so it cannot navigate", () => {
    const { container } = renderItem(baseItem(), { isEditMode: true });
    expect(widgetBody(container)).toHaveAttribute("inert");
  });

  it("does not make a counter panel inert, since its menu lives in its body", () => {
    const { container } = renderItem(
      baseItem({ presetPanelType: PresetPanelType.ALERT_COUNT_PANEL }),
      { isEditMode: true }
    );
    expect(widgetBody(container)).not.toHaveAttribute("inert");
  });

  it("keeps generic metrics usable in edit mode so their filters can be saved", () => {
    const { container } = renderItem(
      baseItem({
        preset: undefined,
        widgetType: WidgetType.GENERICS_METRICS,
        genericMetrics: { key: "alert_quality", label: "Alert Quality" },
      } as Partial<WidgetData>),
      { isEditMode: true }
    );
    expect(widgetBody(container)).not.toHaveAttribute("inert");
    expect(screen.getByText("widget-menu")).toBeInTheDocument();
  });

  const genericMetricsItem = () =>
    baseItem({
      preset: undefined,
      widgetType: WidgetType.GENERICS_METRICS,
      genericMetrics: { key: "alert_quality", label: "Alert Quality" },
    } as Partial<WidgetData>);

  it("puts generic metrics filter changes into the dashboard while editing", () => {
    const onSave = jest.fn();
    render(
      <DashboardEditModeProvider value={true}>
        <GridItem item={genericMetricsItem()} onEdit={jest.fn()} onDelete={jest.fn()} onSave={onSave} />
      </DashboardEditModeProvider>
    );
    fireEvent.click(screen.getByText("change-filters"));
    expect(onSave).toHaveBeenCalledWith({ i: "w1", changed: true });
  });

  it("keeps generic metrics filter changes local in view mode", () => {
    const onSave = jest.fn();
    render(
      <DashboardEditModeProvider value={false}>
        <GridItem item={genericMetricsItem()} onEdit={jest.fn()} onDelete={jest.fn()} onSave={onSave} />
      </DashboardEditModeProvider>
    );
    fireEvent.click(screen.getByText("change-filters"));
    expect(onSave).not.toHaveBeenCalled();
  });
});
