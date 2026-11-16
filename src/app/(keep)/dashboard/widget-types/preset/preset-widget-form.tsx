import { Trashcan } from "@/components/icons";
import { Preset } from "@/entities/presets/model";
import {
  Button,
  Icon,
  Select,
  SelectItem,
  Subtitle,
  Text,
  TextInput,
  Switch,
} from "@tremor/react";
import { useEffect, useMemo, useState } from "react";
import {
  Controller,
  get,
  useForm,
  useWatch,
  useFieldArray,
} from "react-hook-form";
import { omit } from "lodash";
import {
  AlertTableWidgetConfig,
  EmptyGroupPosition,
  LayoutItem,
  Threshold,
  PresetPanelType,
} from "../../types";
import ColumnsSelection from "./columns-selection";
import { CountByControl } from "./count-by-control";
import { EmptyGroupPositionControl } from "./empty-group-position-control";
import { GroupBySelect } from "./group-by-select";
import {
  WIDGET_UNGROUPABLE_COLUMN_IDS,
  resolveFieldIds,
} from "./alert-table-widget-config";
import { CountBy, isShowingMissing } from "@/entities/presets/model/count-by";
import { useFacetPotentialFields } from "@/features/filter/hooks";
import { getAlertColumnOptions } from "@/widgets/alerts-table/lib/alert-column-options";

const GROUPED_COUNTER_ROWS = 4;
const GROUPED_COUNTER_ROWS_WITH_MISSING = 5;

const getGroupedCounterRows = (countBy: CountBy) =>
  isShowingMissing(countBy)
    ? GROUPED_COUNTER_ROWS_WITH_MISSING
    : GROUPED_COUNTER_ROWS;

const GROUPING_HINT = "Grouping works best with 20 or more alerts";
const GROUPING_HINT_BELOW_COUNT = 20;
const DEFAULT_EMPTY_GROUP_POSITION: EmptyGroupPosition = "top";
const isGroupableField = (field: string) =>
  !WIDGET_UNGROUPABLE_COLUMN_IDS.includes(field);

const getAlertTableConfig = (
  saved: AlertTableWidgetConfig | undefined,
  groupBy: string | null,
  emptyGroupPosition: EmptyGroupPosition
): AlertTableWidgetConfig | undefined => {
  const config: AlertTableWidgetConfig = omit(saved ?? {}, [
    "groupBy",
    "emptyGroupPosition",
  ]);
  if (groupBy) {
    config.groupBy = groupBy;
    config.emptyGroupPosition = emptyGroupPosition;
  }
  return Object.keys(config).length > 0 ? config : undefined;
};

function GroupRowsByControl({
  value,
  onChange,
  showHint,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  showHint: boolean;
}) {
  const { data } = useFacetPotentialFields("alerts");
  const fieldOptions = useMemo(
    () =>
      getAlertColumnOptions([], resolveFieldIds(data ?? [])),
    [data]
  );

  return (
    <div className="mb-4 mt-2">
      <Subtitle>Group rows by</Subtitle>
      <GroupBySelect
        value={value}
        onChange={onChange}
        fieldOptions={fieldOptions}
        isGroupable={isGroupableField}
      />
      {showHint && <Text className="mt-1 text-xs">{GROUPING_HINT}</Text>}
    </div>
  );
}

interface PresetForm {
  selectedPreset: string;
  countOfLastAlerts: string;
  thresholds: Threshold[];
  presetPanelType: PresetPanelType;
  showFiringOnly: boolean;
  customLink?: string;
}

export interface PresetWidgetFormProps {
  editingItem?: any;
  presets: Preset[];
  onChange: (formState: any, isValid: boolean) => void;
}

export const PresetWidgetForm: React.FC<PresetWidgetFormProps> = ({
  editingItem,
  presets,
  onChange,
}: PresetWidgetFormProps) => {
  const {
    control,
    formState: { errors, isValid },
    register,
  } = useForm<PresetForm>({
    defaultValues: {
      selectedPreset: editingItem?.preset?.id,
      countOfLastAlerts: editingItem
        ? editingItem.preset.countOfLastAlerts || 0
        : 5,
      thresholds: editingItem?.thresholds || [
        { value: 0, color: "#10b981" }, // Bold emerald green
        { value: 20, color: "#dc2626" }, // Bold red
      ],
      presetPanelType: editingItem?.presetPanelType || PresetPanelType.ALERT_TABLE,
      showFiringOnly: editingItem?.showFiringOnly ?? false,
      customLink: editingItem?.customLink || "",
    },
  });
  const [presetColumns, setPresetColumns] = useState<string[] | undefined>(
    editingItem ? editingItem.presetColumns : undefined
  );
  const [countBy, setCountBy] = useState<CountBy | undefined>(
    editingItem?.countBy
  );
  const [groupBy, setGroupBy] = useState<string | null>(
    editingItem?.alertTable?.groupBy ?? null
  );
  const [emptyGroupPosition, setEmptyGroupPosition] =
    useState<EmptyGroupPosition>(
      editingItem?.alertTable?.emptyGroupPosition ??
        DEFAULT_EMPTY_GROUP_POSITION
    );

  const { fields, append, remove, move, replace } = useFieldArray({
    control,
    name: "thresholds",
  });

  const formValues = useWatch({ control });

  const normalizedFormValues = useMemo(() => {
    return {
      countOfLastAlerts: parseInt(formValues.countOfLastAlerts || "0"),
      selectedPreset: presets.find((p) => p.id === formValues.selectedPreset),
      presetColumns,
      thresholds: formValues.thresholds?.map((t) => ({
        ...t,
        value: parseInt(t.value?.toString() as string, 10) || 0,
      })),
      presetPanelType: formValues.presetPanelType || PresetPanelType.ALERT_TABLE,
      showFiringOnly: formValues.showFiringOnly ?? false,
      customLink: formValues.customLink || "",
      countBy,
      alertTable: getAlertTableConfig(
        editingItem?.alertTable,
        groupBy,
        emptyGroupPosition
      ),
    };
  }, [
    formValues,
    presetColumns,
    countBy,
    groupBy,
    emptyGroupPosition,
    editingItem?.alertTable,
  ]);

  function getLayoutValues(): LayoutItem {
    const isAlertTable = normalizedFormValues.presetPanelType === PresetPanelType.ALERT_TABLE;
    const isAlertCountPanel = normalizedFormValues.presetPanelType === PresetPanelType.ALERT_COUNT_PANEL;

    if (editingItem) {
      if (!isAlertCountPanel) {
        return {} as LayoutItem;
      }
      const countBy = normalizedFormValues.countBy;
      const groupedRows = countBy ? getGroupedCounterRows(countBy) : undefined;
      const savedHeight = editingItem.h;
      const needsRows =
        groupedRows !== undefined &&
        !(typeof savedHeight === "number" && savedHeight >= groupedRows);
      return {
        ...(needsRows ? { h: groupedRows } : {}),
        minH: groupedRows ?? 2,
      } as LayoutItem;
    }
    
    if (isAlertCountPanel) {
      // Narrower, more compact layout for count panels with no minimum width
      const countBy = normalizedFormValues.countBy;
      const groupedRows = countBy ? getGroupedCounterRows(countBy) : undefined;
      return {
        w: 4,
        h: groupedRows ?? 3,
        minW: 0,
        minH: groupedRows ?? 2,
        static: false,
      } as LayoutItem;
    }
    
    // Original layout for alert tables
    const itemHeight = isAlertTable && normalizedFormValues.countOfLastAlerts > 0 ? 6 : 4;
    const itemWidth = isAlertTable && normalizedFormValues.countOfLastAlerts > 0 ? 8 : 6;

    return {
      w: itemWidth,
      h: itemHeight,
      minW: 4,
      minH: 4,
      static: false,
    } as LayoutItem;
  }

  useEffect(() => {
    onChange(
      {
        ...getLayoutValues(),
        preset: {
          ...normalizedFormValues.selectedPreset,
          countOfLastAlerts: normalizedFormValues.countOfLastAlerts,
        },
        presetColumns: normalizedFormValues.presetColumns,
        thresholds: normalizedFormValues.thresholds,
        presetPanelType: normalizedFormValues.presetPanelType,
        showFiringOnly: normalizedFormValues.showFiringOnly,
        customLink: normalizedFormValues.customLink,
        countBy: normalizedFormValues.countBy,
        ...(normalizedFormValues.presetPanelType === PresetPanelType.ALERT_TABLE
          ? { alertTable: normalizedFormValues.alertTable }
          : {}),
      },
      isValid
    );
  }, [normalizedFormValues, isValid]);

  const handleThresholdBlur = () => {
    const reorderedThreesholds = formValues?.thresholds
      ?.map((t) => ({
        ...t,
        value: parseInt(t.value?.toString() as string, 10) || 0,
      }))
      .sort((a, b) => a.value - b.value);
    if (!reorderedThreesholds) {
      return;
    }
    replace(reorderedThreesholds as any);
  };

  const handleAddThreshold = () => {
    const maxThreshold = Math.max(
      ...(formValues.thresholds?.map((t) => t.value) as any),
      0
    );
    append({ value: maxThreshold + 10, color: "#000000" });
  };

  return (
    <>
      <div className="mb-4 mt-2" data-cy="dashboard-widget-form-preset">
        <Subtitle>Preset</Subtitle>
        <Controller
          name="selectedPreset"
          control={control}
          rules={{
            required: {
              value: true,
              message: "Preset selection is required",
            },
          }}
          render={({ field }) => (
            <Select
              {...field}
              placeholder="Select a preset"
              error={!!get(errors, "selectedPreset.message")}
              errorMessage={get(errors, "selectedPreset.message")}
              data-cy="dashboard-widget-form-preset-select"
            >
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </Select>
          )}
        />
      </div>
      <div className="mb-4 mt-2">
        <Subtitle>Panel Type</Subtitle>
        <Controller
          name="presetPanelType"
          control={control}
          rules={{
            required: {
              value: true,
              message: "Panel type selection is required",
            },
          }}
          render={({ field }) => (
            <Select
              {...field}
              placeholder="Select a panel type"
              error={!!get(errors, "presetPanelType.message")}
              errorMessage={get(errors, "presetPanelType.message")}
              data-cy="dashboard-widget-form-panel-type-select"
            >
              <SelectItem value={PresetPanelType.ALERT_TABLE}>
                Alert Table
              </SelectItem>
              <SelectItem value={PresetPanelType.ALERT_COUNT_PANEL}>
                Alert Count Panel
              </SelectItem>
            </Select>
          )}
        />
      </div>
      <CountByControl value={countBy} onChange={setCountBy} />
      {formValues.presetPanelType === PresetPanelType.ALERT_COUNT_PANEL && (
        <>
          {countBy?.field !== "incident" && (
            <div className="mb-4 mt-2">
              <div className="flex items-center justify-between">
                <Subtitle>Show Firing Alerts Only</Subtitle>
                <Controller
                  name="showFiringOnly"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>
          )}
          <div className="mb-4 mt-2">
            <Subtitle>Custom Link (optional)</Subtitle>
            <Controller
              name="customLink"
              control={control}
              render={({ field }) => (
                <TextInput
                  {...field}
                  placeholder="https://example.com or leave empty for preset link"
                  type="url"
                  data-cy="dashboard-widget-form-custom-link-input"
                />
              )}
            />
          </div>
        </>
      )}
      {formValues.presetPanelType === PresetPanelType.ALERT_TABLE && (
        <>
          <div className="mb-4 mt-2">
            <Subtitle>Last alerts count to display</Subtitle>
            <Controller
              name="countOfLastAlerts"
              control={control}
              rules={{
                required: {
                  value: true,
                  message: "Preset selection is required",
                },
              }}
              render={({ field }) => (
                <TextInput
              {...field}
              error={!!get(errors, "countOfLastAlerts.message")}
              errorMessage={get(errors, "countOfLastAlerts.message")}
              onBlur={handleThresholdBlur}
              type="number"
              placeholder="Value indicating how many alerts to display in widget"
              required
              data-cy="dashboard-widget-form-count-of-last-alerts-input"
            />
          )}
        />
      </div>
      <ColumnsSelection
        selectedColumns={presetColumns}
        onChange={(selectedColumns) => setPresetColumns(selectedColumns)}
      ></ColumnsSelection>
          <GroupRowsByControl
            value={groupBy}
            onChange={setGroupBy}
            showHint={
              !!groupBy &&
              normalizedFormValues.countOfLastAlerts < GROUPING_HINT_BELOW_COUNT
            }
          />
          {groupBy && (
            <EmptyGroupPositionControl
              value={emptyGroupPosition}
              onChange={setEmptyGroupPosition}
              titleAs={Subtitle}
              className="mb-4 mt-2"
              optionsClassName="mt-1 flex gap-4 text-sm text-gray-700"
              data-cy="dashboard-widget-form-rows-with-no-value"
            />
          )}
        </>
      )}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <Subtitle>Thresholds</Subtitle>
          <Button
            color="orange"
            variant="secondary"
            type="button"
            onClick={handleAddThreshold}
          >
            +
          </Button>
        </div>
        <div className="mt-4">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center space-x-2 mb-2">
              <TextInput
                {...register(`thresholds.${index}.value`, { required: true })}
                onBlur={handleThresholdBlur}
                placeholder="Threshold value"
                type="number"
                required
              />
              <input
                type="color"
                {...register(`thresholds.${index}.color`, { required: true })}
                className="w-10 h-10 p-1 border"
                required
              />
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-2"
                >
                  <Icon color="orange" icon={Trashcan} className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
