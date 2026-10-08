import React, { useMemo } from "react";
import { Threshold } from "../../types";
import { usePresetAlertCount } from "@/features/presets/custom-preset-links";
import {
  COUNT_LOAD_ERROR_LABEL,
  CountBy,
  getCountUnitLabel,
} from "@/entities/presets/model/count-by";
import { useDashboardPreset } from "@/utils/hooks/useDashboardPresets";
import { Button, Icon } from "@tremor/react";
import { FireIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import MenuButton from "../../MenuButton";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

const ERROR_COLOR = "#9ca3af";

interface WidgetAlertCountPanelProps {
  presetName: string;
  showFiringOnly?: boolean;
  thresholds?: Threshold[];
  customLink?: string;
  dashboardName?: string;
  widgetName?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  countBy?: CountBy;
}

const WidgetAlertCountPanel: React.FC<WidgetAlertCountPanelProps> = ({
  presetName,
  showFiringOnly = false,
  thresholds = [],
  customLink,
  dashboardName,
  widgetName,
  onEdit,
  onDelete,
  onSave,
  countBy,
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

  const {
    totalCount: alertsCount,
    isLoading,
    isError,
  } = usePresetAlertCount({
    presetCel: filterCel,
    counterShowsFiringOnly: showFiringOnly,
    groupBy: countBy?.field,
    incidentStatus: countBy?.incidentStatus,
    refreshInterval: 30000,
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

  function handleBoxClick() {
    if (!preset) {
      return;
    }
    handleGoToPresetClick();
  }

  function handleBoxKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleBoxClick();
    }
  }

  const hasMenu = Boolean(onEdit && onDelete);
  const title = widgetName?.trim() ? widgetName : preset?.name;

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

  const color = isError
    ? ERROR_COLOR
    : getColor(isCountLoading ? 0 : alertsCount);

  const caption = countBy
    ? isError
      ? COUNT_LOAD_ERROR_LABEL
      : getCountUnitLabel(countBy, alertsCount)
    : undefined;

  return (
    <div className="flex flex-col h-full" data-cy="dashboard-widget-alert-count-panel">
      <div
        role="link"
        tabIndex={0}
        aria-label={`Go to preset ${preset?.name ?? ""}`}
        onClick={handleBoxClick}
        onKeyDown={handleBoxKeyDown}
        style={{
          background: hexToRgb(color, 0.15),
          borderColor: color,
          borderWidth: "2px",
        }}
        className="relative flex flex-col max-w-full border rounded-lg p-2 h-full shadow-sm cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1"
        data-cy="dashboard-widget-alert-count-box"
      >
        <div className="flex-none flex items-center gap-1 min-w-0">
          <div className="flex-1 min-w-0 flex items-center justify-center gap-1 text-xl font-bold text-gray-700">
            <span className="truncate">{title}</span>
            {showFiringOnly && (
              <Icon
                className="p-0 shrink-0"
                style={{ color }}
                size="sm"
                icon={FireIcon}
              />
            )}
          </div>
          {(customLink || hasMenu) && (
            <div className="flex-none flex items-center space-x-1">
              {customLink && (
                <Button
                  color="blue"
                  variant="secondary"
                  size="xs"
                  icon={ArrowTopRightOnSquareIcon}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCustomLinkClick();
                  }}
                  tooltip="Go to Link"
                />
              )}
              {hasMenu && (
                <MenuButton
                  compact
                  onEdit={onEdit!}
                  onDelete={onDelete!}
                  onSave={onSave}
                />
              )}
            </div>
          )}
        </div>
        {countBy ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 gap-1.5">
            <div
              className="text-4xl font-black tracking-tight leading-none"
              style={{
                color,
                textShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
              data-cy="dashboard-widget-count-value"
            >
              {isCountLoading ? (
                <Skeleton containerClassName="h-8 w-16" />
              ) : isError ? (
                "—"
              ) : (
                alertsCount
              )}
            </div>
            <div
              className="flex max-w-full items-center gap-1.5 text-xs font-semibold text-gray-700"
              data-cy="dashboard-widget-count-caption"
            >
              <span
                className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
                style={{
                  background: color,
                  boxShadow: `0 0 0 3px ${hexToRgb(color, 0.28)}`,
                }}
              />
              <span className="truncate" title={caption}>
                {caption}
              </span>
            </div>
          </div>
        ) : (
          <div
            className="flex-1 flex items-center justify-center min-h-0 text-4xl font-black tracking-tight"
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
        )}
      </div>
    </div>
  );
};

export default WidgetAlertCountPanel;
