import React from "react";
import { Select, SelectItem, Subtitle, Text } from "@tremor/react";
import {
  COUNT_BY_ALERT_FIELD_OPTIONS,
  CountBy,
  CountByAlertField,
  CountMode,
  DEFAULT_INCIDENT_STATUS,
  INCIDENT_STATUS_OPTIONS,
  IncidentStatusFilter,
  getCountMode,
} from "@/entities/presets/model/count-by";

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
 * incidents, or distinct values of one allowlisted alert field.
 */
export const CountByControl: React.FC<CountByControlProps> = ({
  value,
  onChange,
}) => {
  const mode = getCountMode(value);

  const selectMode = (nextMode: CountMode) => {
    if (nextMode === mode) {
      return;
    }
    if (nextMode === "alerts") {
      onChange(undefined);
    } else if (nextMode === "incidents") {
      onChange({ field: "incident", incidentStatus: DEFAULT_INCIDENT_STATUS });
    } else {
      onChange({ field: COUNT_BY_ALERT_FIELD_OPTIONS[0].value });
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
                onChange({
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
                onChange({ field: field as CountByAlertField })
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
    </div>
  );
};
