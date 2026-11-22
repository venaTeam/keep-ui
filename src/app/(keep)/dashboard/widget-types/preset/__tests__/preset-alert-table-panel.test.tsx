import React from "react";
import {
  act,
  fireEvent,
  render,
  RenderResult,
  screen,
  within,
} from "@testing-library/react";
import { RowSelectionState } from "@tanstack/react-table";
import PresetAlertTablePanel from "../preset-alert-table-panel";
import type { WidgetSelectionProps } from "../widget-alerts-table";
import { DashboardEditModeProvider } from "../../../DashboardEditModeContext";
import { Preset } from "@/entities/presets/model/types";
import { CountBy } from "@/entities/presets/model/count-by";
import { AlertDto, Status } from "@/entities/alerts/model/types";
import type { OpenQuickAction } from "@/features/alerts/alert-quick-actions";
import { PresetPanelType, WidgetData, WidgetType } from "../../../types";

interface HostProps {
  open: OpenQuickAction | null;
  presetName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const mockUsePresetAlertsCount = jest.fn();
const mockUsePresetAlertCount = jest.fn();
const mockPush = jest.fn();
const mockRefresh = jest.fn();
let mockLastTableBackground: string | undefined;
let mockLastTableProps: Record<string, unknown> | undefined;
let mockTablePropsByWidget: Record<string, Record<string, unknown>> = {};
let mockHostProps: HostProps | undefined;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/features/presets/custom-preset-links", () => ({
  usePresetAlertsCount: (...args: unknown[]) =>
    mockUsePresetAlertsCount(...args),
  usePresetAlertCount: (...args: unknown[]) => mockUsePresetAlertCount(...args),
}));

jest.mock("../widget-alerts-table", () => ({
  __esModule: true,
  default: (props: { background?: string; item: WidgetData }) => {
    mockLastTableBackground = props.background;
    mockLastTableProps = props;
    mockTablePropsByWidget[props.item.i] = props;
    return <div data-testid="alerts-table" />;
  },
}));

jest.mock("@/features/alerts/alert-quick-actions", () => ({
  ...jest.requireActual("@/features/alerts/alert-quick-actions"),
  QuickActionDialogHost: (props: HostProps) => {
    mockHostProps = props;
    return null;
  },
  useRefreshAlertQueries: () => mockRefresh,
}));

jest.mock("@/features/alerts/alert-quick-actions/ui/action-dialogs", () => ({
  ChangeStatusDialog: () => null,
  LinkIncidentDialog: () => null,
  DismissDialog: () => null,
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
  missingCount?: number;
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

/** Headless UI, loaded through `@tremor/react`, polyfills `getAnimations` with a console warning; the blink tests get a quiet stub instead. */
function stubGetAnimations() {
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
}

beforeAll(stubGetAnimations);

beforeEach(() => {
  mockUsePresetAlertsCount.mockReset();
  mockUsePresetAlertCount.mockReset();
  mockLastTableBackground = undefined;
  mockLastTableProps = undefined;
  mockTablePropsByWidget = {};
  mockPush.mockReset();
  mockRefresh.mockReset();
  mockHostProps = undefined;
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

  it("keeps the alerts line unmuted and coloured by the alert count", () => {
    renderPanel(buildItem());

    expect(screen.getByText("Alerts count:").parentElement).not.toHaveClass(
      "text-gray-500"
    );
    expect(
      screen.getByText("showing 5 out of 120").parentElement
    ).toHaveStyle({ color: "#dc2626" });
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

    expect(screen.getByText("Alerts count:").parentElement).toHaveClass(
      "text-gray-500"
    );
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

describe("PresetAlertTablePanel with a saved field the UI does not know", () => {
  const unknownField = { field: "severity" } as unknown as CountBy;

  it("renders the group line instead of throwing", () => {
    groupState({ totalCount: 0, isLoading: false, isError: false });
    const { container } = renderPanel(buildItem({ countBy: unknownField }));

    expect(
      container.querySelector('[data-cy="dashboard-widget-group-count"]')
    ).toHaveTextContent("severity:");
  });

  it("renders a generic label when the saved field is not a string", () => {
    groupState({ totalCount: 0, isLoading: false, isError: false });
    const { container } = renderPanel(
      buildItem({ countBy: { field: {} } as unknown as CountBy })
    );

    expect(
      container.querySelector('[data-cy="dashboard-widget-group-count"]')
    ).toHaveTextContent("Unknown field:");
  });

  it("shows a dash with an explanation when the count fails", () => {
    groupState({ totalCount: 0, isLoading: false, isError: true });
    const { container } = renderPanel(buildItem({ countBy: unknownField }));

    expect(
      container.querySelector('[data-cy="dashboard-widget-group-count"]')
    ).toHaveTextContent("—");
    expect(screen.getByTitle("Couldn't load count")).toBeInTheDocument();
  });
});

describe("PresetAlertTablePanel alerts left out of the count", () => {
  const withMissing: CountBy = { ...incidents, showMissing: true };

  const missingLine = (container: HTMLElement) =>
    container.querySelector('[data-cy="dashboard-widget-group-missing"]');

  it("asks for the missing count only when the toggle is on", () => {
    renderPanel(buildItem({ countBy: withMissing }));
    expect(mockUsePresetAlertCount).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeMissing: true })
    );

    renderPanel(buildItem({ countBy: incidents }));
    expect(mockUsePresetAlertCount).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeMissing: false })
    );
  });

  it("shows no line when the toggle is off", () => {
    groupState({ totalCount: 3, missingCount: 4 });
    const { container } = renderPanel(buildItem({ countBy: incidents }));

    expect(missingLine(container)).toBeNull();
  });

  it("shows the left-out alerts under the group count", () => {
    groupState({ totalCount: 3, missingCount: 4 });
    const { container } = renderPanel(buildItem({ countBy: withMissing }));

    expect(missingLine(container)).toHaveTextContent(
      "+ 4 alerts not in an incident"
    );
    expect(screen.getByTestId("alerts-table")).toBeInTheDocument();
    expect(screen.getByText("showing 5 out of 120")).toBeInTheDocument();
  });

  it("shows a dash when the gateway leaves the number out", () => {
    groupState({ totalCount: 3 });
    const { container } = renderPanel(buildItem({ countBy: withMissing }));

    expect(missingLine(container)).toHaveTextContent(/^—$/);
  });

  it("shows no line when the group count fails", () => {
    groupState({ isError: true, missingCount: 4 });
    const { container } = renderPanel(buildItem({ countBy: withMissing }));

    expect(missingLine(container)).toBeNull();
  });

  it("keeps the line without a number while loading", () => {
    groupState({ isLoading: true });
    const { container } = renderPanel(buildItem({ countBy: withMissing }));

    expect(missingLine(container)).not.toBeNull();
    expect(missingLine(container)).not.toHaveTextContent(/\d|—/);
  });
});

describe("PresetAlertTablePanel blinking line", () => {
  const blinking: CountBy = {
    ...incidents,
    showMissing: true,
    blinkMissing: true,
  };

  const missingLine = (container: HTMLElement) =>
    container.querySelector(
      '[data-cy="dashboard-widget-group-missing"]'
    ) as HTMLElement;

  const blinkingPart = (container: HTMLElement) =>
    missingLine(container).querySelector(
      ".motion-safe\\:animate-missing-blink"
    );

  it("shows the left-out alerts as a blinking red label", () => {
    groupState({ totalCount: 3, missingCount: 4 });
    const { container } = renderPanel(buildItem({ countBy: blinking }));

    expect(blinkingPart(container)).toHaveTextContent(
      "+ 4 alerts not in an incident"
    );
    expect(blinkingPart(container)).toHaveStyle({
      backgroundColor: "#dc2626",
      color: "#ffffff",
    });
  });

  it("blinks in the color the widget chose", () => {
    groupState({ totalCount: 3, missingCount: 4 });
    const { container } = renderPanel(
      buildItem({ countBy: { ...blinking, blinkColor: "#16a34a" } })
    );

    expect(
      (blinkingPart(container) as HTMLElement).style.getPropertyValue(
        "--blink-strong"
      )
    ).toBe("#16a34a");
    expect(blinkingPart(container)).toHaveStyle({ backgroundColor: "#16a34a" });
  });

  it.each<[string, Partial<CountBy>, { missingCount?: number; isLoading?: boolean }]>([
    ["the blink is off", { blinkMissing: false }, { missingCount: 4 }],
    ["nothing is left out", {}, { missingCount: 0 }],
    ["the gateway leaves the number out", {}, {}],
    ["the count is loading", {}, { isLoading: true }],
  ])("stays grey when %s", (_name, countByChange, state) => {
    groupState({ totalCount: 3, ...state });
    const { container } = renderPanel(
      buildItem({ countBy: { ...blinking, ...countByChange } })
    );

    expect(missingLine(container)).not.toBeNull();
    expect(blinkingPart(container)).toBeNull();
    expect(missingLine(container)).toHaveClass("text-gray-600");
  });

  it("starts the blink at the page's time zero so every label blinks together", () => {
    const animatedElements: Element[] = [];
    const animation = { startTime: 640 as number | null };
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: function (this: HTMLElement) {
        animatedElements.push(this);
        return [animation];
      },
    });
    try {
      groupState({ totalCount: 3, missingCount: 4 });
      const { container } = renderPanel(buildItem({ countBy: blinking }));

      expect(animatedElements).toContain(blinkingPart(container));
      expect(animation.startTime).toBe(0);
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
    }
  });
});

describe("PresetAlertTablePanel in dashboard edit mode", () => {
  const renderInMode = (
    isEditMode: boolean,
    {
      onSave,
      preset = { id: "p1", name: "feed" } as unknown as Preset,
    }: { onSave?: (item: WidgetData) => void; preset?: Preset } = {}
  ) =>
    render(
      <DashboardEditModeProvider value={isEditMode}>
        <PresetAlertTablePanel
          item={buildItem()}
          preset={preset}
          filterCel=""
          dashboardName="Ops"
          onSave={onSave}
        />
      </DashboardEditModeProvider>
    );

  const goToPreset = () =>
    document.querySelector(
      '[data-cy="dashboard-widget-preset-go-to-btn"]'
    ) as HTMLButtonElement;

  it("Go to preset works in view mode", () => {
    renderInMode(false);

    expect(goToPreset()).not.toBeDisabled();
    fireEvent.click(goToPreset());
    expect(mockPush).toHaveBeenCalledWith(
      "/alerts/feed?fromDashboard=Ops&widgetName=Prod%20Critical"
    );
  });

  it("Go to preset is disabled in edit mode", () => {
    renderInMode(true, { onSave: jest.fn() });

    expect(goToPreset()).toBeDisabled();
    fireEvent.click(goToPreset());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("passes edits to onSave in edit mode and not in view mode", () => {
    const onSave = jest.fn();

    renderInMode(true, { onSave });
    expect(mockLastTableProps).toEqual(
      expect.objectContaining({ isEditMode: true, onChange: onSave })
    );

    renderInMode(false, { onSave });
    expect(mockLastTableProps).toEqual(
      expect.objectContaining({ isEditMode: false, onChange: undefined })
    );
  });

  it("in edit mode gives the table a settings slot right before Go to preset", () => {
    renderInMode(true, { onSave: jest.fn() });

    const slot = mockLastTableProps?.settingsSlot as HTMLElement;
    expect(slot).toBeInstanceOf(HTMLElement);
    expect(slot.nextElementSibling).toBe(goToPreset());
  });

  it("passes selection props in view mode only", () => {
    renderInMode(false);
    expect(mockLastTableProps!.selection).toEqual(
      expect.objectContaining({ rowSelection: {} })
    );

    renderInMode(true, { onSave: jest.fn() });
    expect(mockLastTableProps!.selection).toBeUndefined();

    render(<PresetAlertTablePanel item={buildItem()} filterCel="" />);
    expect(mockLastTableProps!.selection).toBeUndefined();
  });

  it("gives the table no settings slot in view mode", () => {
    renderInMode(false);

    expect(mockLastTableProps?.settingsSlot ?? null).toBeNull();
  });

  it("gives the table the widget and whether the preset is noisy", () => {
    const item = buildItem();
    render(
      <PresetAlertTablePanel
        item={item}
        preset={{ id: "p1", name: "feed", is_noisy: true } as unknown as Preset}
        filterCel=""
      />
    );

    expect(mockLastTableProps).toEqual(
      expect.objectContaining({ item, presetNoisy: true })
    );
    expect(mockLastTableProps).not.toHaveProperty("presetName");
    expect(mockLastTableProps).not.toHaveProperty("presetId");

    renderInMode(false);
    expect(mockLastTableProps).toEqual(
      expect.objectContaining({ presetNoisy: false })
    );
  });

  it("keeps the count lines, the alerts line and Go to preset in order in edit mode", () => {
    groupState({ totalCount: 3, missingCount: 4 });
    render(
      <DashboardEditModeProvider value={true}>
        <PresetAlertTablePanel
          item={buildItem({
            countBy: { ...incidents, showMissing: true, blinkMissing: true },
          })}
          preset={{ id: "p1", name: "feed" } as unknown as Preset}
          filterCel=""
          onSave={jest.fn()}
        />
      </DashboardEditModeProvider>
    );

    const order = Array.from(
      document.querySelectorAll(
        '[data-cy="dashboard-widget-group-count"], [data-cy="dashboard-widget-group-missing"], [data-cy="dashboard-widget-preset-go-to-btn"]'
      )
    ).map((element) => element.getAttribute("data-cy"));
    expect(order).toEqual([
      "dashboard-widget-group-count",
      "dashboard-widget-group-missing",
      "dashboard-widget-preset-go-to-btn",
    ]);
    const missing = document.querySelector(
      '[data-cy="dashboard-widget-group-missing"]'
    )!;
    const alertsLine = screen.getByText("Alerts count:");
    expect(
      missing.compareDocumentPosition(alertsLine) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      document.querySelector(".motion-safe\\:animate-missing-blink")
    ).toHaveTextContent("+ 4 alerts not in an incident");
    expect(screen.getByText("showing 5 out of 120")).toBeInTheDocument();
  });
});

describe("PresetAlertTablePanel quick actions", () => {
  const alert = (fingerprint: string, fields: Partial<AlertDto> = {}) =>
    ({
      id: fingerprint,
      fingerprint,
      name: `alert-${fingerprint}`,
      status: Status.Firing,
      lastReceived: "2026-11-16T10:00:00Z",
      source: ["prometheus"],
      ...fields,
    }) as unknown as AlertDto;

  const withIncident = (base: AlertDto) =>
    ({
      ...base,
      incident_dto: [{ id: "i1", is_candidate: false, status: "firing" }],
    }) as unknown as AlertDto;

  const asSuppressed = (base: AlertDto) =>
    ({ ...base, status: Status.Suppressed }) as AlertDto;

  const a1 = alert("a1");
  const a2 = alert("a2");
  const noInc = alert("no-inc");
  const inInc = withIncident(alert("in-inc"));
  const item = buildItem();
  const preset = { id: "p1", name: "feed" } as unknown as Preset;

  const showAlerts = (alerts: AlertDto[], isLoading = false) =>
    mockUsePresetAlertsCount.mockReturnValue({
      alerts,
      totalCount: alerts.length,
      isLoading,
    });

  const panel = (isEditMode = false) => (
    <DashboardEditModeProvider value={isEditMode}>
      <PresetAlertTablePanel
        item={item}
        preset={preset}
        filterCel=""
        onSave={jest.fn()}
      />
    </DashboardEditModeProvider>
  );

  const renderWithAlerts = (alerts: AlertDto[]) => {
    showAlerts(alerts);
    return render(panel());
  };

  const rerenderWithAlerts = (
    rerender: RenderResult["rerender"],
    alerts: AlertDto[],
    isLoading = false
  ) => {
    showAlerts(alerts, isLoading);
    rerender(panel());
  };

  const tableSelection = () =>
    mockLastTableProps!.selection as WidgetSelectionProps;

  const tick = (next: RowSelectionState) => {
    act(() => {
      tableSelection().onRowSelectionChange(next);
    });
  };

  const openFromStrip = (actionId: string) => {
    const result = renderWithAlerts([a1, a2]);
    tick({ [a1.fingerprint]: true, [a2.fingerprint]: true });
    fireEvent.click(
      document.querySelector(
        `[data-cy="widget-selection-action-${actionId}"]`
      ) as HTMLElement
    );
    return result;
  };

  const goToPreset = () =>
    document.querySelector(
      '[data-cy="dashboard-widget-preset-go-to-btn"]'
    ) as HTMLButtonElement | null;

  it("swaps the count line for the strip while anything is ticked", () => {
    renderWithAlerts([a1, a2]);
    tick({ [a1.fingerprint]: true });

    expect(
      document.querySelector('[data-cy="widget-selection-strip"]')
    ).not.toBeNull();
    expect(screen.queryByText(/Alerts count:/)).toBeNull();
  });

  it("keeps Go to preset in place but hidden and inert while anything is ticked", () => {
    renderWithAlerts([a1, a2]);
    tick({ [a1.fingerprint]: true });

    const button = goToPreset();
    expect(button).not.toBeNull();
    expect(button).toHaveClass("invisible");
    expect(button).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveAttribute("tabindex", "-1");

    fireEvent.click(button!);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("brings the count line and Go to preset back on Clear", () => {
    renderWithAlerts([a1, a2]);
    tick({ [a1.fingerprint]: true });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(
      document.querySelector('[data-cy="widget-selection-strip"]')
    ).toBeNull();
    expect(screen.getByText("Alerts count:")).toBeInTheDocument();
    const button = goToPreset();
    expect(button).not.toHaveClass("invisible");
    expect(button).not.toHaveAttribute("aria-hidden");
    expect(button).not.toHaveAttribute("tabindex");
    fireEvent.click(button!);
    expect(mockPush).toHaveBeenCalledWith("/alerts/feed");
    expect(tableSelection().rowSelection).toEqual({});
  });

  it("drops ticked alerts that a refresh removes", () => {
    const { rerender } = renderWithAlerts([a1, a2]);
    tick({ [a1.fingerprint]: true, [a2.fingerprint]: true });

    rerenderWithAlerts(rerender, [a2]);

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(tableSelection().rowSelection).toEqual({ [a2.fingerprint]: true });
  });

  it("keeps the selection through a loading state", () => {
    const { rerender } = renderWithAlerts([a1, a2]);
    tick({ [a1.fingerprint]: true });

    rerenderWithAlerts(rerender, [], true);
    expect(tableSelection().rowSelection).toEqual({ [a1.fingerprint]: true });

    rerenderWithAlerts(rerender, [a1, a2]);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("opens the dialog with the strip's eligible alerts", () => {
    renderWithAlerts([a1, asSuppressed(a2)]);
    tick({ [a1.fingerprint]: true, [a2.fingerprint]: true });

    fireEvent.click(screen.getByRole("button", { name: "Dismiss 1" }));

    expect(mockHostProps!.open).toEqual({
      actionId: "dismiss",
      alerts: [a1],
    });
    expect(mockHostProps!.presetName).toBe("feed");
  });

  it("links every ticked alert, including those already in an incident", () => {
    renderWithAlerts([noInc, inInc]);
    tick({ [noInc.fingerprint]: true, [inInc.fingerprint]: true });

    expect(screen.queryByRole("button", { name: /^Link \d/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Link to incident" }));

    expect(mockHostProps!.open).toEqual({
      actionId: "link-incident",
      alerts: [noInc, inInc],
    });
  });

  it("keeps the selection when the dialog is cancelled", () => {
    openFromStrip("dismiss");

    act(() => mockHostProps!.onClose());

    expect(mockHostProps!.open).toBeNull();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("clears the selection and refreshes on success", () => {
    openFromStrip("dismiss");

    act(() => mockHostProps!.onSuccess());

    expect(mockHostProps!.open).toBeNull();
    expect(screen.queryByText(/selected/)).toBeNull();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["close then success", ["onClose", "onSuccess"]],
    ["success then close", ["onSuccess", "onClose"]],
  ] as const)(
    "ends closed and cleared when a dialog calls %s",
    (_name, calls) => {
      openFromStrip("change-status");
      const host = mockHostProps!;

      act(() => calls.forEach((call) => host[call]()));

      expect(mockHostProps!.open).toBeNull();
      expect(screen.queryByText(/selected/)).toBeNull();
      expect(screen.getByText("Alerts count:")).toBeInTheDocument();
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    }
  );

  it("clears the selection on Esc", () => {
    renderWithAlerts([a1]);
    tick({ [a1.fingerprint]: true });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByText(/selected/)).toBeNull();
  });

  it("ignores Esc while a dialog is open", () => {
    openFromStrip("change-status");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("clears selection and closes the dialog on entering edit mode", () => {
    const { rerender } = openFromStrip("dismiss");
    expect(mockHostProps!.open).not.toBeNull();

    rerender(panel(true));

    expect(mockHostProps!.open).toBeNull();
    expect(mockLastTableProps!.selection).toBeUndefined();
    expect(screen.queryByText(/selected/)).toBeNull();

    rerender(panel(false));

    expect(tableSelection().rowSelection).toEqual({});
    expect(screen.getByText("Alerts count:")).toBeInTheDocument();
  });

  it("marks the single alert whose dialog is open", () => {
    renderWithAlerts([a1]);

    act(() => tableSelection().onOpenAction("dismiss", [a1], null));

    expect(tableSelection().openFingerprint).toBe(a1.fingerprint);
    expect(mockHostProps!.open).toEqual({ actionId: "dismiss", alerts: [a1] });
  });

  describe("focus handed back to the button that opened a dialog", () => {
    let trayButton: HTMLButtonElement;

    beforeEach(() => {
      jest.useFakeTimers();
      trayButton = document.createElement("button");
      document.body.append(trayButton);
    });

    afterEach(() => {
      trayButton.remove();
      jest.useRealTimers();
    });

    const closeAndHandFocusBack = (end: "onClose" | "onSuccess") => {
      act(() => mockHostProps![end]());
      trayButton.focus();
      act(() => jest.runOnlyPendingTimers());
    };

    it.each(["onClose", "onSuccess"] as const)(
      "is dropped when a mouse opened it and the dialog calls %s",
      (end) => {
        renderWithAlerts([a1]);
        act(() => tableSelection().onOpenAction("dismiss", [a1], trayButton));

        closeAndHandFocusBack(end);

        expect(document.activeElement).toBe(document.body);
      }
    );

    it("is kept when the keyboard opened it", () => {
      renderWithAlerts([a1]);
      act(() => tableSelection().onOpenAction("dismiss", [a1], null));

      closeAndHandFocusBack("onClose");

      expect(document.activeElement).toBe(trayButton);
    });

    it("is dropped from a strip button a mouse pressed", () => {
      renderWithAlerts([a1, a2]);
      tick({ [a1.fingerprint]: true, [a2.fingerprint]: true });
      const stripButton = document.querySelector(
        '[data-cy="widget-selection-action-dismiss"]'
      ) as HTMLButtonElement;
      fireEvent.click(stripButton, { detail: 1 });

      act(() => mockHostProps!.onClose());
      stripButton.focus();
      act(() => jest.runOnlyPendingTimers());

      expect(document.activeElement).toBe(document.body);
      expect(screen.getByText("2 selected")).toBeInTheDocument();
    });
  });

  it("marks no row while a dialog holds several alerts", () => {
    openFromStrip("dismiss");

    expect(mockHostProps!.open!.alerts).toHaveLength(2);
    expect(tableSelection().openFingerprint).toBeNull();
  });

  it("keeps the dialog's alerts when a refresh drops one", () => {
    const { rerender } = openFromStrip("dismiss");

    rerenderWithAlerts(rerender, [a2]);

    expect(mockHostProps!.open!.alerts).toEqual([a1, a2]);
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    act(() => mockHostProps!.onSuccess());

    expect(screen.queryByText(/selected/)).toBeNull();
  });

  it("keeps selections separate per widget", () => {
    showAlerts([a1, a2]);
    render(
      <>
        <div data-testid="widget-w1">
          <PresetAlertTablePanel
            item={buildItem({ i: "w1" })}
            preset={preset}
            filterCel=""
          />
        </div>
        <div data-testid="widget-w2">
          <PresetAlertTablePanel
            item={buildItem({ i: "w2" })}
            preset={preset}
            filterCel=""
          />
        </div>
      </>
    );

    act(() => {
      (
        mockTablePropsByWidget.w1.selection as WidgetSelectionProps
      ).onRowSelectionChange({ [a1.fingerprint]: true });
    });

    const first = within(screen.getByTestId("widget-w1"));
    const second = within(screen.getByTestId("widget-w2"));
    expect(first.getByText("1 selected")).toBeInTheDocument();
    expect(second.getByText("Alerts count:")).toBeInTheDocument();
    expect(second.queryByText(/selected/)).toBeNull();
    expect(
      (mockTablePropsByWidget.w2.selection as WidgetSelectionProps).rowSelection
    ).toEqual({});
  });

  it("counts a duplicated fingerprint once", () => {
    renderWithAlerts([a1, { ...a1 }]);
    tick({ [a1.fingerprint]: true });

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(mockHostProps!.open!.alerts).toHaveLength(1);
  });

  it("recomputes eligibility from refreshed alerts", () => {
    const { rerender } = renderWithAlerts([a1, a2]);
    tick({ [a1.fingerprint]: true, [a2.fingerprint]: true });
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();

    rerenderWithAlerts(rerender, [asSuppressed(a1), a2]);

    expect(
      screen.getByRole("button", { name: "Dismiss 1" })
    ).toBeInTheDocument();
  });
});
