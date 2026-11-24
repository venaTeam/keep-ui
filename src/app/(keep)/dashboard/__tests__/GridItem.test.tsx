import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GridItem from "../GridItem";
import { DashboardEditModeProvider } from "../DashboardEditModeContext";
import { PresetPanelType, WidgetData, WidgetType } from "../types";
import { DashboardTypographyProvider } from "../dashboard-appearance/DashboardTypographyContext";
import type { WidgetTypography } from "../dashboard-appearance/widget-typography";

jest.mock("../MenuButton", () => ({
  __esModule: true,
  default: ({ onEdit }: { onEdit: () => void }) => (
    <button onClick={onEdit}>widget-menu</button>
  ),
}));

const mockPresetGridItem = jest.fn();

jest.mock("../widget-types/preset/preset-grid-item", () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockPresetGridItem(props);
    return <div data-testid="preset-grid-item" />;
  },
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

  it("does not make an alert table inert in edit mode, so its header controls work", () => {
    const { container } = renderItem(baseItem(), { isEditMode: true });
    expect(widgetBody(container)).not.toHaveAttribute("inert");
  });

  it("does not make a legacy alert table without a panel type inert in edit mode", () => {
    const { container } = renderItem(
      baseItem({ presetPanelType: undefined }),
      { isEditMode: true }
    );
    expect(widgetBody(container)).not.toHaveAttribute("inert");
  });

  it("still makes a metric widget inert in edit mode so it cannot navigate", () => {
    const { container } = renderItem(
      baseItem({
        preset: undefined,
        presetPanelType: undefined,
        widgetType: WidgetType.METRIC,
        metric: { id: "m1", name: "MTTR", data: [] },
      } as Partial<WidgetData>),
      { isEditMode: true }
    );
    expect(widgetBody(container)).toHaveAttribute("inert");
  });

  it("still makes an incident table inert in edit mode so it cannot navigate", () => {
    const { container } = renderItem(
      baseItem({
        preset: undefined,
        presetPanelType: undefined,
        widgetType: WidgetType.INCIDENT_TABLE,
      }),
      { isEditMode: true }
    );
    expect(widgetBody(container)).toHaveAttribute("inert");
  });

  it("gives the preset widget onSave only in edit mode", () => {
    const onSave = jest.fn();
    const renderWith = (isEditMode: boolean) =>
      render(
        <DashboardEditModeProvider value={isEditMode}>
          <GridItem item={baseItem()} onEdit={jest.fn()} onDelete={jest.fn()} onSave={onSave} />
        </DashboardEditModeProvider>
      );

    mockPresetGridItem.mockClear();
    renderWith(true);
    expect(mockPresetGridItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ onSave })
    );

    mockPresetGridItem.mockClear();
    renderWith(false);
    expect(mockPresetGridItem.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ onSave: undefined })
    );
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

describe("GridItem typography", () => {
  const renderWithTypography = (
    item: WidgetData,
    dashboard: WidgetTypography | undefined,
    isEditMode = true
  ) =>
    render(
      <DashboardEditModeProvider value={isEditMode}>
        <DashboardTypographyProvider value={dashboard}>
          <GridItem item={item} onEdit={jest.fn()} onDelete={jest.fn()} onSave={jest.fn()} />
        </DashboardTypographyProvider>
      </DashboardEditModeProvider>
    );
  const card = (container: HTMLElement) =>
    container.querySelector('[data-cy="dashboard-widget-w1"]') as HTMLElement;

  it("leaves a widget with no typography anywhere exactly as before", () => {
    const { container } = renderWithTypography(baseItem(), undefined);
    expect(card(container)).not.toHaveAttribute("data-widget-typography");
    expect(card(container).style.fontFamily).toBe("");
    expect(card(container).style.getPropertyValue("--wt-scale")).toBe("");
  });

  it("applies the dashboard text size to the card", () => {
    const { container } = renderWithTypography(baseItem(), { size: "xl" });
    expect(card(container)).toHaveAttribute("data-widget-typography");
    expect(card(container).style.getPropertyValue("--wt-scale")).toBe("1.5238");
  });

  it("lets the widget override win over the dashboard", () => {
    const { container } = renderWithTypography(
      baseItem({ typography: { font: "system", size: "sm", title: "normal" } }),
      { size: "xl" }
    );
    expect(card(container)).not.toHaveAttribute("data-widget-typography");
  });

  it("marks the title so the title size applies to it", () => {
    const { container } = renderWithTypography(baseItem(), { title: "large" });
    expect(
      container.querySelector('[data-cy="dashboard-widget-title"]')
    ).toHaveAttribute("data-widget-title");
  });

  it("shows the Custom type badge for an override in edit mode only", () => {
    const item = baseItem({ typography: { font: "inter", size: "lg", title: "normal" } });
    const { container, unmount } = renderWithTypography(item, undefined, true);
    expect(container.querySelector('[data-cy="dashboard-widget-custom-type"]')).toHaveTextContent(
      "Custom type"
    );
    unmount();
    const view = renderWithTypography(item, undefined, false);
    expect(view.container.querySelector('[data-cy="dashboard-widget-custom-type"]')).toBeNull();
  });

  it("shows no badge for a widget that follows the dashboard", () => {
    const { container } = renderWithTypography(baseItem(), { size: "xl" });
    expect(container.querySelector('[data-cy="dashboard-widget-custom-type"]')).toBeNull();
  });
});
