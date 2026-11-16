import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RowSelectionState } from "@tanstack/react-table";
import { uniqBy } from "lodash";
import { Preset } from "@/entities/presets/model/types";
import { AlertDto } from "@/entities/alerts/model/types";
import {
  usePresetAlertCount,
  usePresetAlertsCount,
} from "@/features/presets/custom-preset-links";
import {
  COUNT_LOAD_ERROR_LABEL,
  MISSING_UNAVAILABLE_LABEL,
  getCountUnitLabel,
  getMissingCountLabel,
  isBlinkingMissing,
  isShowingMissing,
} from "@/entities/presets/model/count-by";
import { Button } from "@tremor/react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useRouter } from "next/navigation";
import {
  OpenQuickAction,
  QuickActionDialogHost,
  SelectionStrip,
  pruneSelection,
  useRefreshAlertQueries,
} from "@/features/alerts/alert-quick-actions";
import WidgetAlertsTable, {
  type WidgetSelectionProps,
} from "./widget-alerts-table";
import { useSyncedAnimation } from "./use-synced-animation";
import { getBlinkColor, getBlinkStyle } from "./blink-palette";
import { WidgetData, WidgetType } from "../../types";
import { useDashboardEditMode } from "../../DashboardEditModeContext";

interface PresetAlertTablePanelProps {
  item: WidgetData;
  preset?: Preset;
  filterCel: string;
  dashboardName?: string;
  onSave?: (item: WidgetData) => void;
}

const getCountOfLastAlerts = (item: WidgetData) =>
  ((item.preset as { countOfLastAlerts?: number } | undefined)
    ?.countOfLastAlerts ?? 0);

const ERROR_COLOR = "#9ca3af";
const NO_SELECTION: RowSelectionState = {};

const hexToRgb = (hex: string, alpha: number = 1) => {
  hex = hex.replace(/^#/, "");

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return `rgb(${r}, ${g}, ${b}, ${alpha})`;
};

const PresetAlertTablePanel: React.FC<PresetAlertTablePanelProps> = ({
  item,
  preset,
  filterCel,
  dashboardName,
  onSave,
}) => {
  const router = useRouter();
  const isEditMode = useDashboardEditMode();
  const [settingsSlot, setSettingsSlot] = useState<HTMLDivElement | null>(null);
  const countOfLastAlerts = getCountOfLastAlerts(item);
  const {
    alerts,
    totalCount: presetAlertsCount = 0,
    isLoading,
  } = usePresetAlertsCount(
    filterCel,
    false,
    countOfLastAlerts,
    0,
    30000,
    !!preset
  );
  const countBy = item.countBy;
  const showMissing = isShowingMissing(countBy);
  const {
    totalCount: groupCount,
    missingCount,
    isLoading: isGroupLoading,
    isError: isGroupError,
  } = usePresetAlertCount({
    presetCel: filterCel,
    counterShowsFiringOnly: false,
    groupBy: countBy?.field,
    incidentStatus: countBy?.incidentStatus,
    includeMissing: showMissing,
    refreshInterval: 30000,
    enabled: !!preset && !!countBy,
  });
  const blinksMissing =
    isBlinkingMissing(countBy) &&
    !isGroupLoading &&
    missingCount !== undefined &&
    missingCount > 0;
  const syncBlink = useSyncedAnimation(blinksMissing);
  const refresh = useRefreshAlertQueries();
  const [rowSelection, setRowSelection] =
    useState<RowSelectionState>(NO_SELECTION);
  const [openAction, setOpenAction] = useState<OpenQuickAction | null>(null);
  const shownAlerts = isLoading ? undefined : alerts;
  const selectedAlerts = useMemo(
    () =>
      uniqBy(
        (shownAlerts ?? []).filter((alert) => rowSelection[alert.fingerprint]),
        "fingerprint"
      ),
    [shownAlerts, rowSelection]
  );
  const isSelecting = selectedAlerts.length > 0;
  const isDialogOpen = openAction !== null;
  const openFingerprint =
    openAction?.alerts.length === 1 ? openAction.alerts[0].fingerprint : null;
  const hasPreset = !!preset;

  useEffect(() => {
    if (!shownAlerts) {
      return;
    }
    const fingerprints = shownAlerts.map((alert) => alert.fingerprint);
    setRowSelection((prev) => pruneSelection(prev, fingerprints));
  }, [shownAlerts]);

  useEffect(() => {
    if (isEditMode) {
      setRowSelection(NO_SELECTION);
      setOpenAction(null);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (!isSelecting || isDialogOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRowSelection(NO_SELECTION);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSelecting, isDialogOpen]);

  const clearSelection = useCallback(() => setRowSelection(NO_SELECTION), []);

  const openQuickAction = useCallback(
    (actionId: string, actionAlerts: AlertDto[]) =>
      setOpenAction({ actionId, alerts: actionAlerts }),
    []
  );

  const handleClose = useCallback(() => setOpenAction(null), []);

  const handleSuccess = useCallback(() => {
    setOpenAction(null);
    setRowSelection(NO_SELECTION);
    refresh();
  }, [refresh]);

  const selection = useMemo<WidgetSelectionProps | undefined>(
    () =>
      !isEditMode && hasPreset
        ? {
            rowSelection,
            onRowSelectionChange: setRowSelection,
            onOpenAction: openQuickAction,
            openFingerprint,
          }
        : undefined,
    [isEditMode, hasPreset, rowSelection, openQuickAction, openFingerprint]
  );

  function handleGoToPresetClick() {
    const presetUrl = `/alerts/${preset?.name.toLowerCase()}`;
    if (dashboardName) {
      router.push(`${presetUrl}?fromDashboard=${encodeURIComponent(dashboardName)}&widgetName=${encodeURIComponent(item.name)}`);
    } else {
      router.push(presetUrl);
    }
  }

  const getColor = () => {
    if (countBy && isGroupError) {
      return ERROR_COLOR;
    }
    const thresholdCount = countBy ? groupCount : presetAlertsCount;
    let color = "#000000";
    if (
      item.widgetType === WidgetType.PRESET &&
      item.thresholds &&
      item.preset
    ) {
      for (let i = item.thresholds.length - 1; i >= 0; i--) {
        if (thresholdCount >= item.thresholds[i].value) {
          color = item.thresholds[i].color;
          break;
        }
      }
    }

    return color;
  };

  const renderAlertsCountText = () => {
    let state: string = "nothingToShow";

    if (countOfLastAlerts > 0) {
      if (presetAlertsCount <= countOfLastAlerts) {
        state = "allAlertsShown";
      } else {
        state = "someAlertsShown";
      }
    }

    return (
      <div
        className={
          countBy
            ? "flex gap-1 items-center text-gray-500"
            : "flex gap-1 items-center"
        }
      >
        <div>Alerts count:</div>
        <div
          className={`flex items-center text-base font-bold ${countBy ? "text-gray-500" : ""}`}
          style={countBy ? undefined : { color: getColor() }}
        >
          {isLoading && (
            <Skeleton containerClassName="h-4 w-8 relative -top-0.5" />
          )}
          {!isLoading && (
            <>
              {state === "nothingToShow" && (
                <span>{presetAlertsCount} alerts</span>
              )}
              {state === "allAlertsShown" && (
                <span>showing {presetAlertsCount} alerts</span>
              )}
              {state === "someAlertsShown" && (
                <span>
                  showing {countOfLastAlerts} out of {presetAlertsCount}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderGroupCountLine = () => {
    if (!countBy) {
      return null;
    }
    const color = getColor();

    return (
      <div
        className="flex gap-1.5 items-center"
        data-cy="dashboard-widget-group-count"
      >
        <span
          className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 0 3px ${hexToRgb(color, 0.28)}`,
          }}
        />
        <div>{getCountUnitLabel(countBy, groupCount)}:</div>
        <div
          className="flex items-center text-base font-bold"
          style={{ color }}
          title={isGroupError ? COUNT_LOAD_ERROR_LABEL : undefined}
        >
          {isGroupLoading ? (
            <Skeleton containerClassName="h-4 w-8 relative -top-0.5" />
          ) : isGroupError ? (
            "—"
          ) : (
            groupCount
          )}
        </div>
      </div>
    );
  };

  const renderMissingLine = () => {
    if (!countBy || !showMissing || isGroupError) {
      return null;
    }
    const label =
      missingCount === undefined
        ? MISSING_UNAVAILABLE_LABEL
        : getMissingCountLabel(countBy, missingCount);

    return (
      <div
        className="flex gap-1.5 items-center text-gray-600"
        data-cy="dashboard-widget-group-missing"
      >
        {!blinksMissing && (
          <span className="inline-block h-[7px] w-[7px] shrink-0 rounded-full border-[1.5px] border-gray-400" />
        )}
        {isGroupLoading ? (
          <Skeleton containerClassName="h-4 w-40 relative -top-0.5" />
        ) : blinksMissing ? (
          <span
            className="truncate rounded-full px-2 font-bold motion-safe:animate-missing-blink"
            style={getBlinkStyle(getBlinkColor(countBy))}
            title={label}
            ref={syncBlink}
          >
            {label}
          </span>
        ) : (
          <span className="truncate" title={label}>
            {label}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex gap-2">
        <div className="flex-1 min-w-0 overflow-hidden whitespace-nowrap">
          {renderGroupCountLine()}
          {renderMissingLine()}
          {isSelecting ? (
            <SelectionStrip
              alerts={selectedAlerts}
              onOpen={openQuickAction}
              onClear={clearSelection}
            />
          ) : (
            renderAlertsCountText()
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isEditMode && <div ref={setSettingsSlot} className="contents" />}
          {!isSelecting && (
            <Button
              color="orange"
              variant="secondary"
              size="xs"
              onClick={handleGoToPresetClick}
              disabled={isEditMode}
              data-cy="dashboard-widget-preset-go-to-btn"
            >
              Go to preset
            </Button>
          )}
        </div>
      </div>
      {countOfLastAlerts > 0 && (
        <WidgetAlertsTable
          item={item}
          isEditMode={isEditMode}
          onChange={isEditMode ? onSave : undefined}
          settingsSlot={settingsSlot}
          alerts={shownAlerts}
          background={
            isLoading || (countBy && isGroupLoading)
              ? undefined
              : hexToRgb(getColor(), 0.1)
          }
          selection={selection}
        />
      )}
      <QuickActionDialogHost
        open={openAction}
        presetName={preset?.name ?? ""}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </>
  );
};

export default PresetAlertTablePanel;
