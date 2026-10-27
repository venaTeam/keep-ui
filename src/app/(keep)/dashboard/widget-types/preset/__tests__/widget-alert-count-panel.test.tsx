import React from "react";
import { render, screen } from "@testing-library/react";
import WidgetAlertCountPanel from "../widget-alert-count-panel";
import { CountBy } from "@/entities/presets/model/count-by";

const mockUsePresetAlertCount = jest.fn();

jest.mock("@/features/presets/custom-preset-links", () => ({
  usePresetAlertCount: (...args: unknown[]) => mockUsePresetAlertCount(...args),
}));

jest.mock("@/utils/hooks/useDashboardPresets", () => ({
  useDashboardPreset: () => [
    {
      id: "p1",
      name: "feed",
      options: [{ label: "CEL", value: "severity == 'critical'" }],
    },
  ],
}));

jest.mock("../../../MenuButton", () => ({
  __esModule: true,
  default: () => null,
}));

const thresholds = [
  { value: 0, color: "#10b981" },
  { value: 10, color: "#dc2626" },
];

const incidents: CountBy = { field: "incident", incidentStatus: "active" };

const hookState = (state: {
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

const renderPanel = (
  props: { countBy?: CountBy; showFiringOnly?: boolean } = {}
) =>
  render(
    <WidgetAlertCountPanel presetName="feed" thresholds={thresholds} {...props} />
  );

const valueOf = (container: HTMLElement) =>
  container.querySelector('[data-cy="dashboard-widget-count-value"]');

const captionOf = (container: HTMLElement) =>
  container.querySelector('[data-cy="dashboard-widget-count-caption"]');

beforeEach(() => {
  mockUsePresetAlertCount.mockReset();
});

describe("WidgetAlertCountPanel counting alerts", () => {
  it("renders the plain number with no caption and no grouping", () => {
    hookState({ totalCount: 120 });
    const { container } = renderPanel();

    expect(screen.getByText("120")).toBeInTheDocument();
    expect(captionOf(container)).toBeNull();
    expect(valueOf(container)).toBeNull();
    expect(mockUsePresetAlertCount).toHaveBeenCalledWith(
      expect.objectContaining({ groupBy: undefined, incidentStatus: undefined })
    );
  });
});

describe("WidgetAlertCountPanel counting distinct values", () => {
  it("asks the hook for the grouped count", () => {
    hookState({ totalCount: 3 });
    renderPanel({ countBy: incidents });

    expect(mockUsePresetAlertCount).toHaveBeenCalledWith(
      expect.objectContaining({
        groupBy: "incident",
        incidentStatus: "active",
        enabled: true,
      })
    );
  });

  it("shows the number above a dot caption", () => {
    hookState({ totalCount: 3 });
    const { container } = renderPanel({ countBy: incidents });

    expect(valueOf(container)).toHaveTextContent("3");
    expect(captionOf(container)).toHaveTextContent("Active incidents");
  });

  it("uses the singular label at one", () => {
    hookState({ totalCount: 1 });
    const { container } = renderPanel({ countBy: { field: "service" } });

    expect(captionOf(container)).toHaveTextContent(/^Service$/);
  });

  it("colours the number from the grouped count, not the alert count", () => {
    hookState({ totalCount: 3 });
    const { container, rerender } = renderPanel({ countBy: incidents });
    expect(valueOf(container)).toHaveStyle({ color: "#10b981" });

    hookState({ totalCount: 27 });
    rerender(
      <WidgetAlertCountPanel
        presetName="feed"
        thresholds={thresholds}
        countBy={incidents}
      />
    );
    expect(valueOf(container)).toHaveStyle({ color: "#dc2626" });
  });

  it("shows zero as 0", () => {
    hookState({ totalCount: 0 });
    const { container } = renderPanel({ countBy: incidents });

    expect(valueOf(container)).toHaveTextContent("0");
  });

  it("keeps the caption while loading and shows no number", () => {
    hookState({ isLoading: true });
    const { container } = renderPanel({ countBy: incidents });

    expect(captionOf(container)).toHaveTextContent("Active incidents");
    expect(valueOf(container)).not.toHaveTextContent(/\d/);
  });

  it("shows a dash and a neutral tile when the count fails, never 0", () => {
    hookState({ totalCount: 0, isError: true });
    const { container } = renderPanel({ countBy: incidents });

    expect(valueOf(container)).toHaveTextContent("—");
    expect(valueOf(container)).toHaveStyle({ color: "#9ca3af" });
    expect(captionOf(container)).toHaveTextContent("Couldn't load count");
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows a dash rather than a stale number when a refresh fails", () => {
    hookState({ totalCount: 5, isLoading: false, isError: true });
    const { container } = renderPanel({ countBy: incidents });

    expect(valueOf(container)).toHaveTextContent("—");
    expect(valueOf(container)).not.toHaveTextContent("5");
    expect(captionOf(container)).toHaveTextContent("Couldn't load count");
    expect(valueOf(container)).toHaveStyle({ color: "#9ca3af" });
  });
});

describe("WidgetAlertCountPanel firing-only toggle", () => {
  it("ignores the toggle for an incident count", () => {
    hookState({ totalCount: 3 });
    const { container } = renderPanel({
      countBy: incidents,
      showFiringOnly: true,
    });

    expect(mockUsePresetAlertCount).toHaveBeenCalledWith(
      expect.objectContaining({ counterShowsFiringOnly: false })
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("applies the toggle to a count of another field", () => {
    hookState({ totalCount: 3 });
    const { container } = renderPanel({
      countBy: { field: "service" },
      showFiringOnly: true,
    });

    expect(mockUsePresetAlertCount).toHaveBeenCalledWith(
      expect.objectContaining({ counterShowsFiringOnly: true })
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies the toggle to a plain alert count", () => {
    hookState({ totalCount: 3 });
    const { container } = renderPanel({ showFiringOnly: true });

    expect(mockUsePresetAlertCount).toHaveBeenCalledWith(
      expect.objectContaining({ counterShowsFiringOnly: true })
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("WidgetAlertCountPanel with a saved field the UI does not know", () => {
  const unknownField = { field: "severity" } as unknown as CountBy;

  it("renders a caption instead of throwing", () => {
    hookState({ totalCount: 0, isLoading: false, isError: false });
    const { container } = renderPanel({ countBy: unknownField });

    expect(captionOf(container)).toHaveTextContent("severity");
  });

  it("renders a generic caption when the saved field is not a string", () => {
    hookState({ totalCount: 0, isLoading: false, isError: false });
    const { container } = renderPanel({
      countBy: { field: {} } as unknown as CountBy,
    });

    expect(captionOf(container)).toHaveTextContent("Unknown field");
  });

  it("shows the grey dash tile when the count fails, never 0", () => {
    hookState({ totalCount: 0, isLoading: false, isError: true });
    const { container } = renderPanel({ countBy: unknownField });

    expect(valueOf(container)).toHaveTextContent("—");
    expect(valueOf(container)).toHaveStyle({ color: "#9ca3af" });
    expect(captionOf(container)).toHaveTextContent("Couldn't load count");
    expect(screen.queryByText("0")).toBeNull();
  });
});
