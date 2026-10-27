import React, { useEffect, useRef, useState } from "react";
import { Subtitle, TextInput } from "@tremor/react";
import { GrafanaPanelWidgetConfig, LayoutItem, WidgetData } from "../../types";
import {
  DashboardGrafanaPanelView,
  useGrafanaEmbedPolicy,
} from "./grafana-panel-grid-item";
import {
  extractGrafanaPanelUrl,
  validateGrafanaPanelUrl,
} from "./grafana-panel-widget-validation";

const NEW_WIDGET_LAYOUT: Partial<LayoutItem> = {
  w: 6,
  h: 6,
  minW: 0,
  minH: 2,
  static: false,
};

/**
 * Grafana panel widget settings: a panel embed URL (or Grafana's pasted
 * `<iframe>` snippet) checked against the admin allowlist, with a live preview.
 */
export function GrafanaPanelWidgetForm({
  editingItem,
  onChange,
}: {
  editingItem?: WidgetData | null;
  onChange: (formValue: Partial<WidgetData>, isValid: boolean) => void;
}) {
  const [input, setInput] = useState(editingItem?.grafanaPanel?.url ?? "");
  const { allowedOrigins, appOrigin } = useGrafanaEmbedPolicy();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const url = extractGrafanaPanelUrl(input);
  const fromSnippet = input.trim().startsWith("<");
  const error =
    fromSnippet && !url
      ? "No iframe src found in the pasted snippet"
      : validateGrafanaPanelUrl(url, allowedOrigins, appOrigin);
  const isValid = error === null;

  useEffect(() => {
    const config: GrafanaPanelWidgetConfig = { url };
    onChangeRef.current(
      { ...(editingItem ? {} : NEW_WIDGET_LAYOUT), grafanaPanel: config },
      isValid
    );
  }, [url, isValid, editingItem]);

  return (
    <div data-cy="dashboard-widget-form-grafana-panel">
      <div className="mb-4 mt-2">
        <Subtitle>Grafana panel URL</Subtitle>
        <TextInput
          value={input}
          onValueChange={setInput}
          aria-label="Grafana panel URL"
          placeholder="Paste Grafana's Share > Embed snippet or a /d-solo/ panel URL"
          error={input !== "" && !!error}
          errorMessage={input !== "" ? (error ?? undefined) : undefined}
          data-cy="dashboard-widget-form-grafana-panel-input"
        />
        {fromSnippet && url && (
          <p
            className="mt-1 break-all text-xs text-gray-500"
            data-cy="dashboard-widget-form-grafana-panel-resolved"
          >
            Using {url}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          {allowedOrigins.length > 0
            ? `In Grafana: panel menu > Share > Embed. Allowed Grafana: ${allowedOrigins.join(", ")}`
            : "Grafana panels are not enabled on this Keep instance."}
        </p>
      </div>

      {isValid && (
        <div className="mb-4">
          <Subtitle>Preview</Subtitle>
          <div className="mt-1 h-48 rounded border p-1">
            <DashboardGrafanaPanelView url={url} title="Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
