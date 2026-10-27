import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MultiSelect,
  MultiSelectItem,
  Subtitle,
  TextInput,
} from "@tremor/react";
import {
  IncidentTableColumn,
  IncidentTableSeverity,
  IncidentTableStatus,
  IncidentTableWidgetConfig,
  WidgetData,
} from "../../types";
import {
  DEFAULT_INCIDENT_TABLE_CONFIG,
  INCIDENT_TABLE_COLUMNS,
  INCIDENT_TABLE_NEW_WIDGET_LAYOUT,
  INCIDENT_TABLE_SEVERITY_OPTIONS,
  INCIDENT_TABLE_STATUS_OPTIONS,
  orderIncidentTableColumns,
  validateIncidentTableConfig,
} from "./incident-table-config";

function keepKnown<T extends string>(known: T[], selected: string[]): T[] {
  return known.filter((value) => selected.includes(value));
}

/**
 * Incident table widget settings: which incident statuses and severities to
 * list, which columns to show, and how many incidents to show at most.
 */
export function IncidentTableWidgetForm({
  editingItem,
  onChange,
}: {
  editingItem?: WidgetData | null;
  onChange: (formValue: Partial<WidgetData>, isValid: boolean) => void;
}) {
  const initial = editingItem?.incidentTable ?? DEFAULT_INCIDENT_TABLE_CONFIG;
  const [statuses, setStatuses] = useState<IncidentTableStatus[]>(
    initial.statuses
  );
  const [severities, setSeverities] = useState<IncidentTableSeverity[]>(
    initial.severities
  );
  const [columns, setColumns] = useState<IncidentTableColumn[]>(
    initial.columns
  );
  const [limitInput, setLimitInput] = useState(String(initial.limit));
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const config = useMemo<IncidentTableWidgetConfig>(
    () => ({
      statuses,
      severities,
      columns: orderIncidentTableColumns(columns),
      limit: Number(limitInput),
    }),
    [statuses, severities, columns, limitInput]
  );
  const errors = validateIncidentTableConfig(config);
  const isValid = Object.keys(errors).length === 0;

  useEffect(() => {
    onChangeRef.current(
      {
        ...(editingItem ? {} : INCIDENT_TABLE_NEW_WIDGET_LAYOUT),
        incidentTable: config,
      },
      isValid
    );
  }, [config, isValid, editingItem]);

  return (
    <div data-cy="dashboard-widget-form-incident-table">
      <div className="mb-4 mt-2">
        <Subtitle>Incident statuses to display</Subtitle>
        <MultiSelect
          value={statuses}
          onValueChange={(selected) =>
            setStatuses(
              keepKnown(
                INCIDENT_TABLE_STATUS_OPTIONS.map((option) => option.value),
                selected
              )
            )
          }
          error={!!errors.statuses}
          errorMessage={errors.statuses}
          aria-label="Incident statuses to display"
          data-cy="dashboard-widget-form-incident-table-statuses"
        >
          {INCIDENT_TABLE_STATUS_OPTIONS.map((option) => (
            <MultiSelectItem key={option.value} value={option.value}>
              {option.label}
            </MultiSelectItem>
          ))}
        </MultiSelect>
      </div>

      <div className="mb-4">
        <Subtitle>Incident severities to display</Subtitle>
        <MultiSelect
          value={severities}
          onValueChange={(selected) =>
            setSeverities(
              keepKnown(
                INCIDENT_TABLE_SEVERITY_OPTIONS.map((option) => option.value),
                selected
              )
            )
          }
          error={!!errors.severities}
          errorMessage={errors.severities}
          aria-label="Incident severities to display"
          data-cy="dashboard-widget-form-incident-table-severities"
        >
          {INCIDENT_TABLE_SEVERITY_OPTIONS.map((option) => (
            <MultiSelectItem key={option.value} value={option.value}>
              {option.label}
            </MultiSelectItem>
          ))}
        </MultiSelect>
      </div>

      <div className="mb-4">
        <Subtitle>Columns</Subtitle>
        <MultiSelect
          value={columns}
          onValueChange={(selected) =>
            setColumns(
              keepKnown(
                INCIDENT_TABLE_COLUMNS.map((column) => column.id),
                selected
              )
            )
          }
          error={!!errors.columns}
          errorMessage={errors.columns}
          aria-label="Columns"
          data-cy="dashboard-widget-form-incident-table-columns"
        >
          {INCIDENT_TABLE_COLUMNS.map((column) => (
            <MultiSelectItem key={column.id} value={column.id}>
              {column.header}
            </MultiSelectItem>
          ))}
        </MultiSelect>
      </div>

      <div className="mb-4">
        <Subtitle>Max incidents to show</Subtitle>
        <TextInput
          type="number"
          value={limitInput}
          onValueChange={setLimitInput}
          aria-label="Max incidents to show"
          error={!!errors.limit}
          errorMessage={errors.limit}
          data-cy="dashboard-widget-form-incident-table-limit"
        />
      </div>
    </div>
  );
}
