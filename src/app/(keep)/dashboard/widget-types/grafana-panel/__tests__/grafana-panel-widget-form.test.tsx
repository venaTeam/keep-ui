import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useConfig } from "@/utils/hooks/useConfig";
import { WidgetData, WidgetType } from "../../../types";
import { GrafanaPanelWidgetForm } from "../grafana-panel-widget-form";

const GRAFANA = "https://grafana.example.com";
const PANEL = `${GRAFANA}/d-solo/abc/demo?orgId=1&panelId=2`;

function lastCall(onChange: jest.Mock) {
  return onChange.mock.calls[onChange.mock.calls.length - 1];
}

function type(value: string) {
  fireEvent.change(screen.getByLabelText("Grafana panel URL"), {
    target: { value },
  });
}

describe("GrafanaPanelWidgetForm", () => {
  beforeEach(() => {
    (useConfig as jest.Mock).mockReturnValue({
      data: { GRAFANA_EMBED_ALLOWED_ORIGINS: [GRAFANA] },
    });
  });

  afterEach(() => {
    (useConfig as jest.Mock).mockReturnValue({ data: {} });
  });

  it("is invalid when empty and lists the allowed origins", () => {
    const onChange = jest.fn();
    const { container } = render(
      <GrafanaPanelWidgetForm onChange={onChange} />
    );
    expect(lastCall(onChange)[1]).toBe(false);
    expect(container.querySelector("iframe")).toBeNull();
    expect(
      screen.getByText(new RegExp(`Allowed Grafana: ${GRAFANA}`))
    ).toBeInTheDocument();
  });

  it("accepts an allowlisted URL and previews it", () => {
    const onChange = jest.fn();
    const { container } = render(
      <GrafanaPanelWidgetForm onChange={onChange} />
    );
    type(PANEL);
    const [value, isValid] = lastCall(onChange);
    expect(isValid).toBe(true);
    expect(value).toMatchObject({ w: 6, h: 6, grafanaPanel: { url: PANEL } });
    expect(container.querySelector("iframe")).toHaveAttribute("src", PANEL);
  });

  it("stores the src of a pasted iframe snippet, not the snippet", () => {
    const onChange = jest.fn();
    render(<GrafanaPanelWidgetForm onChange={onChange} />);
    type(
      `<iframe src="${PANEL.replace("&", "&amp;")}" width="450" height="200" frameborder="0"></iframe>`
    );
    const [value, isValid] = lastCall(onChange);
    expect(isValid).toBe(true);
    expect(value.grafanaPanel).toEqual({ url: PANEL });
    expect(screen.getByText(`Using ${PANEL}`)).toBeInTheDocument();
  });

  it("rejects a URL outside the allowlist without previewing it", () => {
    const onChange = jest.fn();
    const { container } = render(
      <GrafanaPanelWidgetForm onChange={onChange} />
    );
    type("https://evil.example.com/x");
    expect(lastCall(onChange)[1]).toBe(false);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText(/not an allowed grafana/i)).toBeInTheDocument();
  });

  it("rejects a snippet with no iframe src", () => {
    const onChange = jest.fn();
    render(<GrafanaPanelWidgetForm onChange={onChange} />);
    type("<div>nope</div>");
    expect(lastCall(onChange)[1]).toBe(false);
    expect(screen.getByText(/no iframe src/i)).toBeInTheDocument();
  });

  it("keeps an existing widget valid when editing, without layout fields", () => {
    const editingItem = {
      i: "w-1",
      name: "CPU",
      widgetType: WidgetType.GRAFANA_PANEL,
      grafanaPanel: { url: PANEL },
    } as unknown as WidgetData;
    const onChange = jest.fn();
    render(
      <GrafanaPanelWidgetForm editingItem={editingItem} onChange={onChange} />
    );
    const [value, isValid] = lastCall(onChange);
    expect(isValid).toBe(true);
    expect(value).toEqual({ grafanaPanel: { url: PANEL } });
  });
});
