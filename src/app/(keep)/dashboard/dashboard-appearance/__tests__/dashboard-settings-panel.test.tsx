import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DashboardSettingsPanel } from "../DashboardSettingsPanel";
import { DashboardAppearance } from "../dashboard-appearance-validation";

function renderPanel(
  appearance: DashboardAppearance = {},
  overrides: Partial<React.ComponentProps<typeof DashboardSettingsPanel>> = {}
) {
  const props = {
    appearance,
    onChange: jest.fn(),
    onReset: jest.fn(),
    onCancel: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  const utils = render(<DashboardSettingsPanel {...props} />);
  return { ...utils, props };
}

describe("DashboardSettingsPanel", () => {
  it("renders the panel", () => {
    const { container } = renderPanel();
    expect(
      container.querySelector('[data-cy="dashboard-settings-panel"]')
    ).not.toBeNull();
  });

  it("reports a picked background color", () => {
    const { props } = renderPanel();
    fireEvent.change(screen.getByLabelText("Dashboard background color"), {
      target: { value: "#123456" },
    });
    expect(props.onChange).toHaveBeenLastCalledWith({ backgroundColor: "#123456" });
  });

  it("applies a preset color", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    expect(props.onChange).toHaveBeenLastCalledWith({ backgroundColor: "#e6f2fb" });
  });

  it("clears the color with the None preset", () => {
    const { props } = renderPanel({ backgroundColor: "#e6f2fb" });
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    expect(props.onChange).toHaveBeenLastCalledWith({});
  });

  it("changes the grid density", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    expect(props.onChange).toHaveBeenLastCalledWith({ density: "compact" });
  });

  it("resets to default", () => {
    const { props } = renderPanel({ backgroundColor: "#eaf6ec", density: "spacious" });
    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it("cancels", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it("closes", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Close customization panel" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("marks the active preset and density from the current appearance", () => {
    renderPanel({ backgroundColor: "#e6f2fb", density: "spacious" });
    expect(screen.getByRole("button", { name: "Ocean" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "None" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Spacious" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Normal" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("marks None active and normal density when the appearance is unset", () => {
    renderPanel({});
    expect(screen.getByRole("button", { name: "None" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Normal" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
