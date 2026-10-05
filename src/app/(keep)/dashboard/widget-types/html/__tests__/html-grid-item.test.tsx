import React from "react";
import { render, screen } from "@testing-library/react";
import { WidgetData, WidgetType } from "../../../types";
import HtmlGridItem, { DashboardHtmlView } from "../html-grid-item";

function iframeOf(container: HTMLElement): HTMLIFrameElement {
  const frame = container.querySelector("iframe");
  if (!frame) {
    throw new Error("no iframe rendered");
  }
  return frame as HTMLIFrameElement;
}

describe("DashboardHtmlView", () => {
  it("renders the author's HTML inside a sandboxed iframe document", () => {
    const { container } = render(
      <DashboardHtmlView html="<h1>Runbook</h1>" title="Notes" />
    );
    const frame = iframeOf(container);
    expect(frame.getAttribute("srcdoc")).toContain("<h1>Runbook</h1>");
    expect(frame).toHaveAttribute("title", "Notes");
  });

  it("sandboxes the frame with scripting disabled", () => {
    const { container } = render(
      <DashboardHtmlView html="<p>x</p>" title="Notes" />
    );
    const frame = iframeOf(container);
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-scripts");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
  });

  it("confines a hostile payload to the scriptless sandbox instead of the app DOM", () => {
    const hostile =
      '<script>fetch("/api?c="+document.cookie)</script><img src=x onerror="alert(1)">';
    const { container } = render(
      <DashboardHtmlView html={hostile} title="Bad" />
    );
    const frame = iframeOf(container);
    expect(frame.getAttribute("srcdoc")).toContain(hostile);
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(container.querySelector("script")).toBeNull();
  });

  it("fills the card with a borderless frame", () => {
    const { container } = render(
      <DashboardHtmlView html="<p>x</p>" title="Notes" />
    );
    expect(iframeOf(container)).toHaveClass("h-full", "w-full", "border-0");
  });

  it("shows a placeholder instead of an empty frame when there is no content", () => {
    const { container } = render(<DashboardHtmlView html="   " title="Empty" />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText(/no content/i)).toBeInTheDocument();
  });
});

describe("HtmlGridItem", () => {
  const item = {
    i: "w-1",
    name: "Notes",
    widgetType: WidgetType.HTML,
    html: { html: "<h2>Hello</h2>" },
  } as unknown as WidgetData;

  it("renders nothing without an html config", () => {
    const { container } = render(
      <HtmlGridItem item={{ ...item, html: undefined } as WidgetData} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mounts the view in an overflow-safe panel that fills the card", () => {
    const { container } = render(<HtmlGridItem item={item} />);
    const panel = container.querySelector(
      '[data-cy="dashboard-widget-html-panel"]'
    ) as HTMLElement;
    expect(panel).toHaveClass("min-h-0", "flex-1");
    expect(iframeOf(panel).getAttribute("srcdoc")).toContain("<h2>Hello</h2>");
  });
});
