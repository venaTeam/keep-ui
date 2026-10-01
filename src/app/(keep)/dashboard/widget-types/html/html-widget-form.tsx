import React, { useEffect, useRef, useState } from "react";
import { Subtitle } from "@tremor/react";
import { HtmlWidgetConfig, LayoutItem, WidgetData } from "../../types";
import { DashboardHtmlView } from "./html-grid-item";
import { validateHtmlContent } from "./html-widget-validation";

const NEW_WIDGET_LAYOUT: Partial<LayoutItem> = {
  w: 4,
  h: 4,
  minW: 0,
  minH: 2,
  static: false,
};

/** HTML widget settings: an HTML textarea with a live, sandboxed preview. */
export function HtmlWidgetForm({
  editingItem,
  onChange,
}: {
  editingItem?: WidgetData | null;
  onChange: (formValue: Partial<WidgetData>, isValid: boolean) => void;
}) {
  const [html, setHtml] = useState(editingItem?.html?.html ?? "");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const error = validateHtmlContent(html);
  const isValid = error === null;

  useEffect(() => {
    const config: HtmlWidgetConfig = { html };
    onChangeRef.current(
      { ...(editingItem ? {} : NEW_WIDGET_LAYOUT), html: config },
      isValid
    );
  }, [html, isValid, editingItem]);

  return (
    <div data-cy="dashboard-widget-form-html">
      <div className="mb-4 mt-2">
        <Subtitle>HTML content</Subtitle>
        <textarea
          value={html}
          onChange={(event) => setHtml(event.target.value)}
          aria-label="HTML content"
          rows={10}
          spellCheck={false}
          placeholder="<h2>Runbook</h2> — headings, notes, styled blocks, links"
          className="mt-1 block w-full rounded border p-2 font-mono text-sm"
          data-cy="dashboard-widget-form-html-input"
        />
        {html !== "" && error && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
        {/<iframe[\s>]/i.test(html) && (
          <p
            className="mt-1 text-sm text-amber-600"
            data-cy="dashboard-widget-form-html-iframe-hint"
          >
            Embedded frames are blocked in HTML widgets. To show a Grafana
            panel, use the Grafana Panel widget type.
          </p>
        )}
      </div>

      {isValid && (
        <div className="mb-4">
          <Subtitle>Preview</Subtitle>
          <div className="mt-1 h-40 rounded border p-1">
            <DashboardHtmlView html={html} title="Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
