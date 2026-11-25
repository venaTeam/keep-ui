import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { WidgetType } from "../../types";
import { describeTypography, WidgetTypographySection } from "../WidgetTypographySection";
import type { WidgetTypography } from "../widget-typography";

jest.mock("@tremor/react", () => ({
  ...jest.requireActual("@tremor/react"),
  Select: () => <div data-testid="font-select" />,
  SelectItem: () => null,
}));

const renderSection = (
  value: WidgetTypography | undefined,
  dashboard: WidgetTypography | undefined,
  widgetType = WidgetType.PRESET
) => {
  const onChange = jest.fn();
  render(
    <WidgetTypographySection
      value={value}
      dashboard={dashboard}
      widgetType={widgetType}
      widgetName="Prod alerts"
      onChange={onChange}
    />
  );
  return onChange;
};

const toggle = () =>
  screen.getByRole("switch", { name: "Custom for this widget" });

describe("describeTypography", () => {
  it("describes the defaults", () => {
    expect(describeTypography(undefined)).toBe(
      "System default · S text · Normal titles"
    );
  });

  it("describes a dashboard setting", () => {
    expect(describeTypography({ font: "inter", size: "xl", title: "large" })).toBe(
      "Inter · XL text · Large titles"
    );
  });
});

describe("WidgetTypographySection", () => {
  it("is off by default and says which dashboard setting applies", () => {
    renderSection(undefined, { size: "xl" });
    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/Uses the dashboard setting/)).toHaveTextContent(
      "Uses the dashboard setting: System default · XL text · Normal titles. Change it for all widgets in Customize."
    );
    expect(screen.queryByRole("group", { name: "Text size" })).toBeNull();
  });

  it("seeds a full override from the dashboard when turned on", () => {
    const onChange = renderSection(undefined, { size: "xl" });
    fireEvent.click(toggle());
    expect(onChange).toHaveBeenLastCalledWith({
      font: "system",
      size: "xl",
      title: "normal",
    });
  });

  it("reports undefined when turned off", () => {
    const onChange = renderSection({ font: "inter", size: "lg", title: "normal" }, undefined);
    fireEvent.click(toggle());
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("reports a full override when a step changes", () => {
    const onChange = renderSection({ font: "inter", size: "lg", title: "normal" }, undefined);
    fireEvent.click(screen.getByRole("button", { name: "Title size XL" }));
    expect(onChange).toHaveBeenLastCalledWith({ font: "inter", size: "lg", title: "xl" });
  });

  it.each([WidgetType.IMAGE, WidgetType.HTML, WidgetType.GRAFANA_PANEL])(
    "notes that only the title changes for %s",
    (type) => {
      renderSection({ font: "inter", size: "lg", title: "normal" }, undefined, type);
      expect(screen.getByText("Applies to the title only.")).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Text size" })).toBeNull();
      expect(screen.getByRole("group", { name: "Title size" })).toBeInTheDocument();
    }
  );

  it("has no title-only note for a preset widget", () => {
    renderSection({ font: "inter", size: "lg", title: "normal" }, undefined);
    expect(screen.queryByText("Applies to the title only.")).toBeNull();
  });
});
