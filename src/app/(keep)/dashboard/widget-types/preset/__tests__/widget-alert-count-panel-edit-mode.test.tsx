import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import WidgetAlertCountPanel from "../widget-alert-count-panel";
import { DashboardEditModeProvider } from "../../../DashboardEditModeContext";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/features/presets/custom-preset-links", () => ({
  usePresetAlertCount: () => ({
    totalCount: 3,
    isLoading: false,
    isError: false,
  }),
}));

jest.mock("@/utils/hooks/useDashboardPresets", () => ({
  useDashboardPreset: () => [{ id: "p1", name: "feed", options: [] }],
}));

jest.mock("../../../MenuButton", () => ({
  __esModule: true,
  default: () => <div data-testid="panel-menu" />,
}));

const renderPanel = (isEditMode: boolean) =>
  render(
    <DashboardEditModeProvider value={isEditMode}>
      <WidgetAlertCountPanel
        presetName="feed"
        customLink="https://example.com"
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    </DashboardEditModeProvider>
  );

const box = () =>
  document.querySelector('[data-cy="dashboard-widget-alert-count-box"]')!;

beforeEach(() => {
  mockPush.mockClear();
});

describe("WidgetAlertCountPanel in view mode", () => {
  it("goes to the preset when the box is clicked", () => {
    renderPanel(false);
    fireEvent.click(box());
    expect(mockPush).toHaveBeenCalledWith("/alerts/feed");
  });

  it("shows the custom link and hides the menu", () => {
    renderPanel(false);
    // The custom-link button is the panel's only real button here.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByTestId("panel-menu")).toBeNull();
  });
});

describe("WidgetAlertCountPanel in edit mode", () => {
  it("does not navigate when the box is clicked or activated by keyboard", () => {
    renderPanel(true);
    fireEvent.click(box());
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("is not exposed as a link", () => {
    renderPanel(true);
    expect(box()).not.toHaveAttribute("role");
    expect(box()).not.toHaveAttribute("tabindex");
  });

  it("shows the menu and hides the custom link", () => {
    renderPanel(true);
    expect(screen.getByTestId("panel-menu")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
