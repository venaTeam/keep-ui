import React from "react";
import { useConfig } from "@/utils/hooks/useConfig";
import { WidgetData } from "../../types";
import {
  GRAFANA_PANEL_SANDBOX,
  validateGrafanaPanelUrl,
} from "./grafana-panel-widget-validation";

/** The admin allowlist of Grafana origins and the origin Keep is served from. */
export function useGrafanaEmbedPolicy() {
  const { data: config } = useConfig();
  return {
    allowedOrigins: config?.GRAFANA_EMBED_ALLOWED_ORIGINS ?? [],
    appOrigin: typeof window === "undefined" ? "" : window.location.origin,
  };
}

/**
 * Frames a single Grafana panel directly in the dashboard. The URL is
 * re-validated against the current allowlist on every render, so a widget
 * saved through the API or an origin later removed from the allowlist is
 * never framed.
 */
export function DashboardGrafanaPanelView({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const { allowedOrigins, appOrigin } = useGrafanaEmbedPolicy();
  const error = validateGrafanaPanelUrl(url, allowedOrigins, appOrigin);
  if (error) {
    return (
      <div
        className="flex h-full w-full items-center justify-center p-2 text-center text-sm text-gray-500"
        data-cy="dashboard-widget-grafana-panel-blocked"
      >
        Grafana panel blocked: {error}
      </div>
    );
  }
  return (
    <iframe
      title={title}
      src={url.trim()}
      sandbox={GRAFANA_PANEL_SANDBOX}
      referrerPolicy="no-referrer"
      loading="lazy"
      className="h-full w-full rounded border-0"
      data-cy="dashboard-widget-grafana-panel"
    />
  );
}

export default function GrafanaPanelGridItem({ item }: { item: WidgetData }) {
  if (!item.grafanaPanel) {
    return null;
  }
  return (
    <div
      className="mt-2 min-h-0 flex-1"
      data-cy="dashboard-widget-grafana-panel-panel"
    >
      <DashboardGrafanaPanelView
        url={item.grafanaPanel.url}
        title={item.name}
      />
    </div>
  );
}
