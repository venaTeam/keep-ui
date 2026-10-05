import React, { useEffect, useState } from "react";
import { Card } from "@tremor/react";
import { RxDragHandleDots2 } from "react-icons/rx";
import MenuButton from "./MenuButton";
import { WidgetData, WidgetType, PresetPanelType } from "./types";
import PresetGridItem from "./widget-types/preset/preset-grid-item";
import MetricGridItem from "./widget-types/metric/metric-grid-item";
import GenericMetricsGridItem from "./widget-types/generic-metrics/generic-metrics-grid-item";
import WidgetServiceNow from "./widget-types/service-now/widget-service-now";
import ImageGridItem from "./widget-types/image/image-grid-item";
import HtmlGridItem from "./widget-types/html/html-grid-item";

interface GridItemProps {
  item: WidgetData;
  onEdit: (id: string, updateData?: WidgetData) => void;
  onDelete: (id: string) => void;
  onSave: (updateItem: WidgetData) => void;
  isDraggable?: boolean;
}

const GridItem: React.FC<GridItemProps> = ({
  item,
  onEdit,
  onDelete,
  onSave,
  isDraggable = false,
}) => {
  const [updatedItem, setUpdatedItem] = useState<WidgetData>(item);

  useEffect(() => {
    setUpdatedItem(item);
  }, [item]);

  const handleEdit = () => {
    onEdit(updatedItem.i, updatedItem);
  };

  const handleDelete = () => onDelete(item.i);
  const handleSave = () => onSave(updatedItem);

  const isAlertCountPanel =
    item.presetPanelType === PresetPanelType.ALERT_COUNT_PANEL;

  return (
    <Card className="relative w-full h-full p-3" data-cy={`dashboard-widget-${item.i}`}>
      {isDraggable && (
        <span
          className="grid-item__widget absolute left-0.5 top-3 h-7 flex items-center text-gray-400 hover:text-gray-600"
          title="Drag to move"
          aria-label="Drag to move widget"
          data-cy="dashboard-widget-drag-handle"
        >
          <RxDragHandleDots2 className="w-4 h-4" />
        </span>
      )}
      <div className="flex flex-col h-full px-2">
        {!isAlertCountPanel && (
          <div className={`flex-none flex items-center justify-between`}>
            <span className="text-lg font-bold grid-item__widget" title={item.name} data-cy="dashboard-widget-title">
              {item.name}
            </span>
            <MenuButton
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSave={handleSave}
            />
          </div>
        )}
        {item.preset && (
          <PresetGridItem
            item={item}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSave={handleSave}
          />
        )}
        {item.metric && <MetricGridItem item={item} />}
        {item.genericMetrics && (
          <GenericMetricsGridItem
            item={item}
            onEdit={setUpdatedItem}
          ></GenericMetricsGridItem>
        )}
        {item.widgetType === WidgetType.SERVICE_NOW && (
          <WidgetServiceNow
            thresholds={item.thresholds}
            team={item.serviceNowTeam}
            status={item.serviceNowStatus}
            detection={item.serviceNowDetection}
            customLink={item.customLink}
          />
        )}
        {item.widgetType === WidgetType.IMAGE && <ImageGridItem item={item} />}
        {item.widgetType === WidgetType.HTML && <HtmlGridItem item={item} />}
      </div>
    </Card>
  );
};

export default GridItem;
