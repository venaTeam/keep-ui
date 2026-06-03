import React, { useMemo } from "react";
import { Threshold } from "../../types";
import { usePresetAlertCount } from "@/features/presets/custom-preset-links";
import { useDashboardPreset } from "@/utils/hooks/useDashboardPresets";
import { Button, Icon } from "@tremor/react";
import { FireIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { AiOutlineSwap } from "react-icons/ai";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

interface WidgetAlertCountPanelProps {
  presetName: string;
  showFiringOnly?: boolean;
  thresholds?: Threshold[];
  customLink?: string;
  dashboardName?: string;
  widgetName?: string;
}

const WidgetAlertCountPanel: React.FC<WidgetAlertCountPanelProps> = ({
  presetName,
  showFiringOnly = false,
  thresholds = [],
  customLink,
  dashboardName,
  widgetName,
}) => {
  const searchParams = useSearchParams();
  const timeRangeCel = useMemo(() => {
    const timeRangeSearchParam = searchParams.get("time_stamp");
    if (timeRangeSearchParam) {
      const parsedTimeRange = JSON.parse(timeRangeSearchParam);
      return `lastReceived >= "${parsedTimeRange.start}" && lastReceived <= "${parsedTimeRange.end}"`;
    }
    return "";
  }, [searchParams]);

  const presets = useDashboardPreset();
  const preset = useMemo(
    () => presets.find((preset) => preset.name === presetName),
    [presets, presetName]
  );

  const presetCel = useMemo(
    () => preset?.options.find((option) => option.label === "CEL")?.value || "",
    [preset]
  );

  const filterCel = useMemo(
    () => [timeRangeCel, presetCel].filter(Boolean).join(" && "),
    [presetCel, timeRangeCel]
  );

  const { totalCount: alertsCount, isLoading } = usePresetAlertCount({
    presetCel: filterCel,
    counterShowsFiringOnly: showFiringOnly,
    refreshInterval: 10000,
    enabled: !!preset,
  });

  const router = useRouter();

  function handleGoToPresetClick() {
    const presetUrl = `/alerts/${preset?.name.toLowerCase()}`;
    if (dashboardName && widgetName) {
      router.push(`${presetUrl}?fromDashboard=${encodeURIComponent(dashboardName)}&widgetName=${encodeURIComponent(widgetName)}`);
    } else {
      router.push(presetUrl);
    }
  }

  function handleCustomLinkClick() {
    if (customLink) {
      window.open(customLink, "_blank");
    }
  }

  const isCountLoading = isLoading || !preset;

  const getColor = (count: number) => {
    let color = "#1f2937";
    if (thresholds.length > 0 && !isCountLoading) {
      for (let i = thresholds.length - 1; i >= 0; i--) {
        if (count >= thresholds[i].value) {
          color = thresholds[i].color;
          break;
        }
      }
    }
    return color;
  };

  function hexToRgb(hex: string, alpha: number = 1) {
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
  }

  const color = getColor(isCountLoading ? 0 : alertsCount);

  return (
    <div className="flex flex-col h-full" data-cy="dashboard-widget-alert-count-panel">
      <div className="flex items-center justify-end mb-2 flex-shrink-0">
        <div className="flex items-center space-x-1">
          <Button
            color="orange"
            variant="secondary"
            size="xs"
            icon={AiOutlineSwap}
            onClick={handleGoToPresetClick}
            tooltip="Go to Preset"
          />
          {customLink && (
            <Button
              color="blue"
              variant="secondary"
              size="xs"
              icon={ArrowTopRightOnSquareIcon}
              onClick={handleCustomLinkClick}
              tooltip="Go to Link"
            />
          )}
        </div>
      </div>
      <div
        style={{
          background: hexToRgb(color, 0.15),
          borderColor: color,
          borderWidth: "2px",
        }}
        className="max-w-full border rounded-lg p-2 h-full shadow-sm"
      >
        <div className="flex-1 flex flex-col justify-center min-h-0">
          <div className="flex flex-col space-y-2 items-center">
            <div className="text-2xl font-bold text-gray-700 flex items-center gap-1">
              {preset?.name}
              {showFiringOnly && (
                <Icon
                  className="p-0"
                  style={{ color }}
                  size="sm"
                  icon={FireIcon}
                />
              )}
            </div>
            <div
              className="text-4xl font-black tracking-tight"
              style={{
                color,
                textShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              {isCountLoading ? (
                <Skeleton containerClassName="h-8 w-16" />
              ) : (
                alertsCount
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetAlertCountPanel;
