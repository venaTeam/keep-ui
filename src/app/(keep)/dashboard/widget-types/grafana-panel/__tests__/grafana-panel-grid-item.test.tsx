import React from "react";
import { render, screen } from "@testing-library/react";
import { useConfig } from "@/utils/hooks/useConfig";
import { WidgetData, WidgetType } from "../../../types";
import GrafanaPanelGridItem, {
  DashboardGrafanaPanelView,
} from "../grafana-panel-grid-item";
import { GRAFANA_PANEL_SANDBOX } from "../grafana-panel-widget-validation";

const GRAFANA = "https://grafana.example.com";
const PANEL = `${GRAFANA}/d-solo/abc/demo?orgId=1&panelId=2`;

function allow(origins: string[]) {
  (useConfig as jest.Mock).mockReturnValue({
    data: { GRAFANA_EMBED_ALLOWED_ORIGINS: origins },
  });
}

describe("DashboardGrafanaPanelView", () => {
  afterEach(() => allow([]));

  it("frames an allowlisted panel URL with the panel sandbox and no referrer", () => {
    allow([GRAFANA]);
    const { container } = render(
      <DashboardGrafanaPanelView url={PANEL} title="CPU" />
    );
    const frame = container.querySelector("iframe") as HTMLIFrameElement;
    expect(frame).toHaveAttribute("src", PANEL);
    expect(frame).toHaveAttribute("sandbox", GRAFANA_PANEL_SANDBOX);
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(frame).toHaveAttribute("title", "CPU");
    expect(frame).not.toHaveAttribute("srcdoc");
  });

  it("refuses a stored URL whose origin is not allowlisted", () => {
    allow([GRAFANA]);
    const { container } = render(
      <DashboardGrafanaPanelView url="https://evil.example.com/x" title="Bad" />
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText(/grafana panel blocked/i)).toHaveTextContent(
      /not an allowed grafana/i
    );
  });

  it("refuses a stored allowlisted URL that is not a single panel", () => {
    allow([GRAFANA]);
    const { container } = render(
      <DashboardGrafanaPanelView url={`${GRAFANA}/explore`} title="Explore" />
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText(/grafana panel blocked/i)).toHaveTextContent(
      /d-solo/
    );
  });

  it("refuses everything when Grafana panels are disabled", () => {
    allow([]);
    const { container } = render(
      <DashboardGrafanaPanelView url={PANEL} title="CPU" />
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText(/grafana panel blocked/i)).toHaveTextContent(
      /not enabled/
    );
  });

  it("refuses Keep's own origin even when allowlisted", () => {
    allow([window.location.origin]);
    const { container } = render(
      <DashboardGrafanaPanelView
        url={`${window.location.origin}/alerts`}
        title="Self"
      />
    );
    expect(container.querySelector("iframe")).toBeNull();
  });
});

describe("GrafanaPanelGridItem", () => {
  const item = {
    i: "w-1",
    name: "CPU",
    widgetType: WidgetType.GRAFANA_PANEL,
    grafanaPanel: { url: PANEL },
  } as unknown as WidgetData;

  afterEach(() => allow([]));

  it("renders nothing without a grafanaPanel config", () => {
    const { container } = render(
      <GrafanaPanelGridItem
        item={{ ...item, grafanaPanel: undefined } as WidgetData}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mounts the frame in a panel that fills the card", () => {
    allow([GRAFANA]);
    const { container } = render(<GrafanaPanelGridItem item={item} />);
    const panel = container.querySelector(
      '[data-cy="dashboard-widget-grafana-panel-panel"]'
    ) as HTMLElement;
    expect(panel).toHaveClass("min-h-0", "flex-1");
    expect(panel.querySelector("iframe")).toHaveAttribute("src", PANEL);
  });
});
