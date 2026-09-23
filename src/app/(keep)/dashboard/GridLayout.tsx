import React, { useCallback, useMemo, useRef, useState } from "react";
import { Responsive, WidthProvider, Layout, Layouts } from "react-grid-layout";
import GridItemContainer from "./GridItemContainer";
import { LayoutItem, WidgetData } from "./types";
import "react-grid-layout/css/styles.css";
import { MetricsWidget } from "@/utils/hooks/useDashboardMetricWidgets";
import { Preset } from "@/entities/presets/model/types";

const ResponsiveGridLayout = WidthProvider(Responsive);

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };

const COLS = { lg: 24, md: 24, sm: 1, xs: 1, xxs: 1 };

const STACKED_COLS = 1;

const EDITABLE_BREAKPOINTS = ["lg", "md"];

const isEditableBreakpoint = (breakpoint: string) => EDITABLE_BREAKPOINTS.includes(breakpoint);

const buildStackedLayout = (layout: LayoutItem[]): LayoutItem[] => {
  let nextY = 0;
  return [...layout]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((item) => {
      const stackedItem: LayoutItem = {
        ...item,
        x: 0,
        y: nextY,
        w: STACKED_COLS,
        minW: STACKED_COLS,
      };
      nextY += item.h;
      return stackedItem;
    });
};

interface GridLayoutProps {
  layout: LayoutItem[];
  onLayoutChange: (layout: LayoutItem[]) => void;
  data: WidgetData[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  presets: Preset[];
  onSave: (updateItem: WidgetData) => void;
  metrics: MetricsWidget[];
}

const GridLayout: React.FC<GridLayoutProps> = ({
  layout,
  onLayoutChange,
  data,
  onEdit,
  onDelete,
  onSave,
  presets,
  metrics,
}) => {
  const breakpointRef = useRef<string>("lg");
  const [isEditable, setIsEditable] = useState(true);

  const layouts = useMemo<Layouts>(() => {
    const stacked = buildStackedLayout(layout);
    return { lg: layout, md: layout, sm: stacked, xs: stacked, xxs: stacked };
  }, [layout]);

  const handleBreakpointChange = useCallback((breakpoint: string) => {
    breakpointRef.current = breakpoint;
    setIsEditable(isEditableBreakpoint(breakpoint));
  }, []);

  const handleLayoutChange = useCallback(
    (currentLayout: Layout[]) => {

      if (!isEditableBreakpoint(breakpointRef.current)) {
        return;
      }

      const updatedLayout = currentLayout.map((item) => ({
        ...item,
        static: item.static ?? false, 
      }));
      onLayoutChange(updatedLayout as LayoutItem[]);
    },
    [onLayoutChange]
  );

  return (
    <>
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        onBreakpointChange={handleBreakpointChange}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={30}
        containerPadding={[0, 0]}
        margin={[10, 10]}
        useCSSTransforms={true}
        isDraggable={isEditable}
        isResizable={isEditable}
        compactType={null}
        draggableHandle=".grid-item__widget"
        transformScale={1}
      >
        {data.map((item) => {
          if (item.preset) {
            const preset = presets?.find((p) => p?.id === item?.preset?.id);
            item.preset = {
              ...item.preset,
              alerts_count: preset?.alerts_count ?? 0,
            };
          } else if (item.metric) {
            const metric = metrics?.find((m) => m?.id === item?.metric?.id);
            if (metric) {
              item.metric = { ...metric };
            }
          }
          return (
            <div key={item.i} data-cy={`dashboard-widget-cell-${item.i}`}>
              <GridItemContainer
                key={item.i}
                item={item}
                onEdit={onEdit}
                onDelete={onDelete}
                onSave={onSave}
              />
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </>
  );
};

export default GridLayout;
