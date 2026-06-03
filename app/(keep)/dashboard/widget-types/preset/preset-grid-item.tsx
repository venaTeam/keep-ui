import React, { useMemo } from "react";
import { WidgetData, PresetPanelType } from "../../types";
import { useDashboardPreset } from "@/utils/hooks/useDashboardPresets";
import { useParams, useSearchParams } from "next/navigation";
import WidgetAlertCountPanel from "./widget-alert-count-panel";
import PresetAlertTablePanel from "./preset-alert-table-panel";

interface GridItemProps {
  item: WidgetData;
}

const PresetGridItem: React.FC<GridItemProps> = ({ item }) => {
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
    () => presets.find((preset) => preset.id === item.preset?.id),
    [presets, item.preset?.id]
  );
  const presetCel = useMemo(
    () => preset?.options.find((option) => option.label === "CEL")?.value || "",
    [preset]
  );
  const filterCel = useMemo(
    () => [timeRangeCel, presetCel].filter(Boolean).join(" && "),
    [presetCel, timeRangeCel]
  );

  const params = useParams();
  const dashboardId = params?.id as string | undefined;
  const dashboardName = dashboardId ? decodeURIComponent(dashboardId) : undefined;

  const isAlertTable =
    item.presetPanelType === PresetPanelType.ALERT_TABLE ||
    !item.presetPanelType;
  const isAlertCountPanel =
    item.presetPanelType === PresetPanelType.ALERT_COUNT_PANEL;

  return (
    <div className="flex flex-col overflow-y-auto gap-2">
      {isAlertTable && (
        <PresetAlertTablePanel
          item={item}
          preset={preset}
          filterCel={filterCel}
          dashboardName={dashboardName}
        />
      )}
      {isAlertCountPanel && (
        <WidgetAlertCountPanel
          presetName={preset?.name as string}
          showFiringOnly={item.showFiringOnly}
          thresholds={item.thresholds}
          customLink={item.customLink}
          dashboardName={dashboardName}
          widgetName={item.name}
        />
      )}
    </div>
  );
};

export default PresetGridItem;
