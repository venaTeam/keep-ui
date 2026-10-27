import React from "react";
import { WidgetData } from "../../types";
import { buildHtmlSrcDoc } from "./html-widget-validation";

/**
 * Renders author HTML inside a scriptless sandboxed iframe. The empty `sandbox`
 * attribute gives the frame an opaque origin with every capability withheld, so
 * scripts, forms, popups and top-navigation are inert and the content cannot
 * reach the Keep session or the parent DOM. Content taller than the frame
 * scrolls internally and never overflows the dashboard card.
 */
export function DashboardHtmlView({
  html,
  title,
}: {
  html: string;
  title: string;
}) {
  if (!html.trim()) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-sm text-gray-400"
        data-cy="dashboard-widget-html-empty"
      >
        No content
      </div>
    );
  }
  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={buildHtmlSrcDoc(html)}
      className="h-full w-full rounded border-0"
      data-cy="dashboard-widget-html"
    />
  );
}

export default function HtmlGridItem({ item }: { item: WidgetData }) {
  if (!item.html) {
    return null;
  }
  return (
    <div className="mt-2 min-h-0 flex-1" data-cy="dashboard-widget-html-panel">
      <DashboardHtmlView html={item.html.html} title={item.name} />
    </div>
  );
}
