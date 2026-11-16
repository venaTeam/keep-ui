import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import PresetAlertTablePanel from "../preset-alert-table-panel";
import { Preset } from "@/entities/presets/model/types";
import { AlertDto, Severity, Status } from "@/entities/alerts/model/types";
import type { OpenQuickAction } from "@/features/alerts/alert-quick-actions";
import { PresetPanelType, WidgetData, WidgetType } from "../../../types";

interface HostProps {
  open: OpenQuickAction | null;
  presetName: string;
}

const mockUsePresetAlertsCount = jest.fn();
let mockHostProps: HostProps | undefined;

jest.mock("@/features/presets/custom-preset-links", () => ({
  usePresetAlertsCount: (...args: unknown[]) =>
    mockUsePresetAlertsCount(...args),
  usePresetAlertCount: () => ({
    totalCount: 0,
    isLoading: false,
    isError: false,
  }),
}));

jest.mock("@/features/alerts/alert-quick-actions", () => ({
  ...jest.requireActual("@/features/alerts/alert-quick-actions"),
  QuickActionDialogHost: (props: HostProps) => {
    mockHostProps = props;
    return null;
  },
  useRefreshAlertQueries: () => jest.fn(),
}));

jest.mock("@/features/alerts/alert-quick-actions/ui/action-dialogs", () => ({
  ChangeStatusDialog: () => null,
  LinkIncidentDialog: () => null,
  DismissDialog: () => null,
}));

jest.mock("@/features/filter/hooks", () => ({
  ...jest.requireActual("@/features/filter/hooks"),
  useFacetPotentialFields: () => ({ data: [] }),
}));

jest.mock("@/utils/hooks/useProviders", () => ({
  useProviders: () => ({ data: undefined }),
}));

jest.mock("@/utils/hooks/useConfig", () => ({
  useConfig: jest.fn(() => ({ data: {} })),
  useApiUrl: () => "http://localhost:8080",
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard/ops",
}));

const alertWith = (id: string): AlertDto =>
  ({
    id,
    event_id: `event-${id}`,
    fingerprint: `fp-${id}`,
    name: `alert-${id}`,
    description: `description ${id}`,
    status: Status.Firing,
    severity: Severity.Warning,
    lastReceived: new Date("2026-11-16T10:00:00Z"),
    environment: "prod",
    source: ["prometheus"],
    pushed: true,
    deleted: false,
    ticket_url: "",
    enriched_fields: [],
  }) as unknown as AlertDto;

const item = {
  i: "w1",
  x: 0,
  y: 0,
  w: 8,
  h: 6,
  name: "Prod Critical",
  widgetType: WidgetType.PRESET,
  preset: { id: "p1", name: "feed", countOfLastAlerts: 5 },
  presetPanelType: PresetPanelType.ALERT_TABLE,
} as unknown as WidgetData;

beforeEach(() => {
  localStorage.clear();
  mockHostProps = undefined;
  mockUsePresetAlertsCount.mockReset();
});

describe("PresetAlertTablePanel with the real alert table", () => {
  it("opens Dismiss from the strip for the row ticked in the table", () => {
    const first = alertWith("1");
    const second = alertWith("2");
    mockUsePresetAlertsCount.mockReturnValue({
      alerts: [first, second],
      totalCount: 2,
      isLoading: false,
    });
    render(
      <PresetAlertTablePanel
        item={item}
        preset={{ id: "p1", name: "feed" } as unknown as Preset}
        filterCel=""
      />
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: `Select ${first.name}` })
    );

    const strip = document.querySelector(
      '[data-cy="widget-selection-strip"]'
    ) as HTMLElement;
    expect(strip).not.toBeNull();
    expect(within(strip).getByText("1 selected")).toBeInTheDocument();

    fireEvent.click(within(strip).getByRole("button", { name: "Dismiss" }));

    expect(mockHostProps?.open).toEqual({
      actionId: "dismiss",
      alerts: [first],
    });
    expect(mockHostProps?.presetName).toBe("feed");
  });
});
