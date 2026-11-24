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

  describe("typography", () => {
    it("reports a picked font", () => {
      const { props } = renderPanel();
      fireEvent.click(screen.getByRole("button", { name: /^Inter/ }));
      expect(props.onChange).toHaveBeenLastCalledWith({ typography: { font: "inter" } });
    });

    it("keeps other appearance fields when changing the text size", () => {
      const { props } = renderPanel({ density: "compact" });
      fireEvent.click(screen.getByRole("button", { name: "Text size XL" }));
      expect(props.onChange).toHaveBeenLastCalledWith({
        density: "compact",
        typography: { size: "xl" },
      });
    });

    it("removes typography when every field is back to the default", () => {
      const { props } = renderPanel({ typography: { size: "xl" } });
      fireEvent.click(screen.getByRole("button", { name: "Text size S" }));
      expect(props.onChange).toHaveBeenLastCalledWith({});
    });

    it("marks the saved steps as selected", () => {
      renderPanel({ typography: { size: "lg", title: "xl" } });
      expect(screen.getByRole("button", { name: "Text size L" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(screen.getByRole("button", { name: "Title size XL" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(screen.getByRole("button", { name: /^System default/ })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });

    it("captions each text size with the alert-table cell size at the viewer's root", () => {
      renderPanel();
      expect(screen.getByRole("button", { name: "Text size S" })).toHaveTextContent("S10.5px");
      expect(screen.getByRole("button", { name: "Text size 2XL" })).toHaveTextContent("2XL20px");
    });
  });
});
