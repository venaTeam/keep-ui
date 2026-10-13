import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { WidgetData, WidgetType } from "../../../types";
import { HtmlWidgetForm } from "../html-widget-form";
import { DEFAULT_MAX_HTML_BYTES } from "../html-widget-validation";

function lastCall(onChange: jest.Mock) {
  return onChange.mock.calls[onChange.mock.calls.length - 1];
}

function type(value: string) {
  fireEvent.change(screen.getByLabelText("HTML content"), {
    target: { value },
  });
}

describe("HtmlWidgetForm", () => {
  it("is invalid with no content and shows no preview", () => {
    const onChange = jest.fn();
    const { container } = render(<HtmlWidgetForm onChange={onChange} />);
    expect(lastCall(onChange)[1]).toBe(false);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("becomes valid once content is entered and previews it", () => {
    const onChange = jest.fn();
    const { container } = render(<HtmlWidgetForm onChange={onChange} />);
    type("<h1>Runbook</h1>");
    const [value, isValid] = lastCall(onChange);
    expect(isValid).toBe(true);
    expect(value).toMatchObject({ w: 4, h: 4, html: { html: "<h1>Runbook</h1>" } });
    expect(container.querySelector("iframe")?.getAttribute("srcdoc")).toContain(
      "<h1>Runbook</h1>"
    );
  });

  it("rejects content over the size cap with a visible message", () => {
    const onChange = jest.fn();
    render(<HtmlWidgetForm onChange={onChange} />);
    type("a".repeat(DEFAULT_MAX_HTML_BYTES + 1));
    expect(lastCall(onChange)[1]).toBe(false);
    expect(screen.getByRole("alert")).toHaveTextContent(/50 KB/);
  });

  it("points pasted iframes to the Grafana Panel widget", () => {
    render(<HtmlWidgetForm onChange={jest.fn()} />);
    expect(screen.queryByText(/grafana panel widget/i)).toBeNull();
    type('<iframe src="https://grafana.example.com/d-solo/x"></iframe>');
    expect(screen.getByText(/grafana panel widget/i)).toBeInTheDocument();
  });

  it("keeps an existing widget valid when editing, without layout fields", () => {
    const editingItem = {
      i: "w-1",
      name: "Notes",
      widgetType: WidgetType.HTML,
      html: { html: "<p>existing</p>" },
    } as unknown as WidgetData;
    const onChange = jest.fn();
    render(<HtmlWidgetForm editingItem={editingItem} onChange={onChange} />);
    const [value, isValid] = lastCall(onChange);
    expect(isValid).toBe(true);
    expect(value).toEqual({ html: { html: "<p>existing</p>" } });
    expect(screen.getByLabelText("HTML content")).toHaveValue("<p>existing</p>");
  });
});
