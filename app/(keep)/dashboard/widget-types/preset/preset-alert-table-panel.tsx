import React from "react";
import { Preset } from "@/entities/presets/model/types";
import { usePresetAlertsCount } from "@/features/presets/custom-preset-links";
import { Button } from "@tremor/react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useRouter } from "next/navigation";
import WidgetAlertsTable from "./widget-alerts-table";
import { WidgetData, WidgetType } from "../../types";

interface PresetAlertTablePanelProps {
  item: WidgetData;
  preset?: Preset;
  filterCel: string;
  dashboardName?: string;
}

const getCountOfLastAlerts = (item: WidgetData) =>
  ((item.preset as { countOfLastAlerts?: number } | undefined)
    ?.countOfLastAlerts ?? 0);

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
}) => {
  const router = useRouter();
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
    10000,
    !!preset
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
    let color = "#000000";
    if (
      item.widgetType === WidgetType.PRESET &&
      item.thresholds &&
      item.preset
    ) {
      for (let i = item.thresholds.length - 1; i >= 0; i--) {
        if (presetAlertsCount >= item.thresholds[i].value) {
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
      <div className="flex gap-1 items-center">
        <div>Alerts count:</div>
        <div
          className="flex items-center text-base font-bold"
          style={{ color: getColor() }}
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

  return (
    <>
      <div className="flex gap-2">
        <div className="flex-1 min-w-0 overflow-hidden whitespace-nowrap">
          <div className="flex gap-1 items-center">
            <div>Preset name:</div>
            <div
              className="truncate cursor-pointer hover:text-orange-500 transition-colors"
              onClick={handleGoToPresetClick}
            >
              {preset?.name}
            </div>
          </div>
          {renderAlertsCountText()}
        </div>
        <div className="flex items-center">
          <Button
            color="orange"
            variant="secondary"
            size="xs"
            onClick={handleGoToPresetClick}
            data-cy="dashboard-widget-preset-go-to-btn"
          >
            Go to preset
          </Button>
        </div>
      </div>
      {countOfLastAlerts > 0 && (
        <WidgetAlertsTable
          presetName={preset?.name as string}
          alerts={isLoading ? undefined : alerts}
          columns={(item as any)?.presetColumns}
          background={isLoading ? undefined : hexToRgb(getColor(), 0.1)}
        />
      )}
    </>
  );
};

export default PresetAlertTablePanel;
