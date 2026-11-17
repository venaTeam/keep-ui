import React from "react";
import { Select, SelectItem, Subtitle, Switch, Text } from "@tremor/react";
import {
  BLINK_MISSING_TOGGLE_LABEL,
  COUNT_BY_ALERT_FIELD_OPTIONS,
  CountBy,
  CountByAlertField,
  CountMode,
  DEFAULT_INCIDENT_STATUS,
  INCIDENT_STATUS_OPTIONS,
  IncidentStatusFilter,
  getBlinkMissingToggleHelp,
  getCountMode,
  getMissingToggleHelp,
  getMissingToggleLabel,
  isBlinkingMissing,
  isShowingMissing,
} from "@/entities/presets/model/count-by";
import { getBlinkColor } from "./blink-palette";

interface CountByControlProps {
  value?: CountBy;
  onChange: (value?: CountBy) => void;
}

const MODES: ReadonlyArray<{ mode: CountMode; label: string }> = [
  { mode: "alerts", label: "Alerts" },
  { mode: "incidents", label: "Incidents" },
  { mode: "field", label: "Other field" },
];

/**
 * Chooses what a preset widget counts: alerts (the default), distinct
 * incidents, or distinct values of one allowlisted alert field. A grouped
 * count can also show the alerts it leaves out, and make them blink in a
 * chosen color; those choices survive changes of status, field and grouped
 * mode, and are dropped with the grouping.
 */
export const CountByControl: React.FC<CountByControlProps> = ({
  value,
  onChange,
}) => {
  const mode = getCountMode(value);
  const showMissing = isShowingMissing(value);
  const blinkMissing = isBlinkingMissing(value);

  const change = (next: CountBy) => {
    if (!showMissing) {
      onChange(next);
      return;
    }
    const kept: CountBy = { ...next, showMissing: true };
    if (blinkMissing) {
      kept.blinkMissing = true;
    }
    if (value?.blinkColor !== undefined) {
      kept.blinkColor = value.blinkColor;
    }
    onChange(kept);
  };

  const selectMode = (nextMode: CountMode) => {
    if (nextMode === mode) {
      return;
    }
    if (nextMode === "alerts") {
      onChange(undefined);
    } else if (nextMode === "incidents") {
      change({ field: "incident", incidentStatus: DEFAULT_INCIDENT_STATUS });
    } else {
      change({ field: COUNT_BY_ALERT_FIELD_OPTIONS[0].value });
    }
  };

  return (
    <div className="mb-4 mt-2" data-cy="dashboard-widget-form-count-by">
      <Subtitle>Count</Subtitle>
      <div
        role="radiogroup"
        aria-label="Count"
        className="mt-1 flex overflow-hidden rounded-md border border-gray-300 text-sm"
      >
        {MODES.map(({ mode: optionMode, label }) => {
          const selected = optionMode === mode;
          return (
            <button
              key={optionMode}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectMode(optionMode)}
              data-cy={`dashboard-widget-form-count-mode-${optionMode}`}
              className={`flex-1 border-r border-gray-200 py-1.5 last:border-r-0 ${
                selected
                  ? "bg-orange-50 font-semibold text-orange-700 ring-1 ring-inset ring-orange-500"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {mode === "incidents" && (
        <>
          <Text className="mt-1 text-xs">
            Distinct incidents with at least one alert matching the preset.
          </Text>
          <div className="mt-3">
            <Subtitle>Incident status</Subtitle>
            <Select
              value={value?.incidentStatus ?? DEFAULT_INCIDENT_STATUS}
              onValueChange={(status) =>
                change({
                  field: "incident",
                  incidentStatus: status as IncidentStatusFilter,
                })
              }
              data-cy="dashboard-widget-form-incident-status-select"
            >
              {INCIDENT_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </div>
        </>
      )}
      {mode === "field" && (
        <>
          <div className="mt-3">
            <Subtitle>Field</Subtitle>
            <Select
              value={value?.field ?? COUNT_BY_ALERT_FIELD_OPTIONS[0].value}
              onValueChange={(field) =>
                change({ field: field as CountByAlertField })
              }
              data-cy="dashboard-widget-form-count-field-select"
            >
              {COUNT_BY_ALERT_FIELD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </div>
          <Text className="mt-1 text-xs">
            Counts distinct values of that field. Empty values aren&apos;t
            counted.
          </Text>
        </>
      )}
      {value && mode !== "alerts" && (
        <div className="mt-3" data-cy="dashboard-widget-form-count-missing">
          <div className="flex items-center justify-between gap-2">
            <Subtitle>{getMissingToggleLabel(value)}</Subtitle>
            <Switch
              checked={showMissing}
              onChange={(checked) =>
                onChange({ ...value, showMissing: checked })
              }
            />
          </div>
          <Text className="mt-1 text-xs">{getMissingToggleHelp(value)}</Text>
        </div>
      )}
      {value && mode !== "alerts" && showMissing && (
        <div
          className="ml-3 mt-2 border-l-2 border-gray-200 pl-3"
          data-cy="dashboard-widget-form-count-missing-blink"
        >
          <div className="flex items-center justify-between gap-2">
            <Subtitle>{BLINK_MISSING_TOGGLE_LABEL}</Subtitle>
            {blinkMissing && (
              <input
                type="color"
                aria-label="Blink color"
                value={getBlinkColor(value)}
                onChange={(e) =>
                  onChange({ ...value, blinkColor: e.target.value })
                }
                className="ml-auto h-7 w-9 cursor-pointer rounded border p-0.5"
                data-cy="dashboard-widget-form-count-missing-blink-color"
              />
            )}
            <Switch
              checked={blinkMissing}
              onChange={(checked) =>
                onChange({ ...value, blinkMissing: checked })
              }
            />
          </div>
          <Text className="mt-1 text-xs">
            {getBlinkMissingToggleHelp(value)}
          </Text>
        </div>
      )}
    </div>
  );
};
