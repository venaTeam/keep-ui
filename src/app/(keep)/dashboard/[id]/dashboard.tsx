"use client";
import { useParams } from "next/navigation";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import GridLayout from "../GridLayout";
import WidgetModal from "../WidgetModal";
import { Button, Card, Icon, Subtitle, TextInput } from "@tremor/react";
import {
  GenericsMetrics,
  LayoutItem,
  Threshold,
  WidgetData,
  WidgetType,
} from "../types";
import {
  clampAppearance,
  DashboardAppearance,
  DEFAULT_APPEARANCE,
} from "../dashboard-appearance/dashboard-appearance-validation";
import { DashboardSettingsPanel } from "../dashboard-appearance/DashboardSettingsPanel";
import { FiEdit2, FiSave, FiSliders } from "react-icons/fi";
import { useDashboards } from "utils/hooks/useDashboards";
import { toast } from "react-toastify";
import { GenericFilters } from "@/components/filters/GenericFilters";
import { useDashboardPreset } from "utils/hooks/useDashboardPresets";
import {
  MetricsWidget,
  useDashboardMetricWidgets,
} from "@/utils/hooks/useDashboardMetricWidgets";
import { useApi } from "@/shared/lib/hooks/useApi";
import { showErrorToast } from "@/shared/ui";
import "../styles.css";
import { Preset } from "@/entities/presets/model/types";
import { recordAction, recordPageLoad, recordError } from "@/utils/metrics";

const DASHBOARD_FILTERS = [
  {
    type: "date",
    key: "time_stamp",
    value: "",
    name: "Last received",
  },
];

const DashboardPage = () => {

  // Record page load time - call directly since useEffect may not fire reliably in Next.js React 19
  if (typeof window !== "undefined") {
    recordPageLoad("dashboard_detail");
  }
  const api = useApi();
  const allPresets = useDashboardPreset();
  const { id }: any = useParams();
  const { dashboards, isLoading, mutate: mutateDashboard } = useDashboards();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [widgetData, setWidgetData] = useState<WidgetData[]>([]);
  const { widgets: allMetricWidgets } = useDashboardMetricWidgets(true);
  const [editingItem, setEditingItem] = useState<WidgetData | null>(null);
  const [dashboardName, setDashboardName] = useState(decodeURIComponent(id));
  const [isEditingName, setIsEditingName] = useState(false);
  const [appearance, setAppearance] =
    useState<DashboardAppearance>(DEFAULT_APPEARANCE);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsSnapshot = useRef<DashboardAppearance>(DEFAULT_APPEARANCE);

  useEffect(() => {
    if (!isLoading) {
      const dashboard = dashboards?.find(
        (d) => d.dashboard_name === decodeURIComponent(id)
      );
      if (dashboard) {
        setLayout(dashboard.dashboard_config.layout);
        setWidgetData(dashboard.dashboard_config.widget_data);
        setDashboardName(dashboard.dashboard_name);
        setAppearance(clampAppearance(dashboard.dashboard_config.appearance));
      }
    }
  }, [id, dashboards, isLoading]);

  const openModal = () => {
    setEditingItem(null); // Ensure new modal opens without editing item context
    setIsModalOpen(true);
  };
  const closeModal = () => setIsModalOpen(false);

  const openSettings = () => {
    settingsSnapshot.current = appearance;
    setIsSettingsOpen(true);
  };
  const closeSettings = () => setIsSettingsOpen(false);
  const cancelSettings = () => {
    setAppearance(settingsSnapshot.current);
    setIsSettingsOpen(false);
  };
  const resetAppearance = () => setAppearance(DEFAULT_APPEARANCE);

  const handleAddWidget = (widget: any) => {
    const uniqueId = `w-${Date.now()}`;
    const newItem: LayoutItem = {
      i: uniqueId,
      x: 0,
      y: 0,
      w: 3,
      h: 3,
      minW: 2,
      minH: 3,
      static: false,
    };
    const newWidget: WidgetData = {
      ...newItem,
      ...widget,
    };
    setLayout((prevLayout) => [...prevLayout, newWidget]);
    setWidgetData((prevData) => [...prevData, newWidget]);
  };

  const handleEditWidget = (id: string, update?: WidgetData) => {
    let itemToEdit = widgetData.find((d) => d.i === id) || null;
    if (itemToEdit && update) {
      setEditingItem({ ...itemToEdit, ...update });
    } else {
      setEditingItem(itemToEdit);
    }
    setIsModalOpen(true);
  };

  const handleSaveEdit = (updatedItem: WidgetData) => {
    setWidgetData((prevData) =>
      prevData.map((item) => (item.i === updatedItem.i ? updatedItem : item))
    );
    closeModal();
  };

  const handleDeleteWidget = (id: string) => {
    setLayout(layout.filter((item) => item.i !== id));
    setWidgetData(widgetData.filter((item) => item.i !== id));
  };

  const handleLayoutChange = (newLayout: LayoutItem[]) => {
    setLayout(newLayout);
    setWidgetData((prevData) =>
      prevData.map((item) => {
        const newItem = newLayout.find((l) => l.i === item.i);
        return newItem ? { ...item, ...newItem } : item;
      })
    );
  };

  const handleSaveDashboard = async () => {
    try {
      let dashboard = dashboards?.find(
        (d) => d.dashboard_name === decodeURIComponent(id)
      );

      const method = dashboard ? "PUT" : "POST";
      const endpoint = `/dashboard${
        dashboard ? `/${encodeURIComponent(dashboard.id)}` : ""
      }`;

      const isNewDashboard = method === "POST";
      const start = isNewDashboard ? performance.now() : 0;

      const result = await api.post(
        endpoint,
        {
          dashboard_name: dashboardName,
          dashboard_config: {
            layout,
            widget_data: widgetData,
            appearance,
          },
        },
        {
          method,
        }
      );

      if (isNewDashboard) {
        recordAction("create_dashboard", (performance.now() - start) / 1000);
      }

      console.log("Dashboard saved successfully", result);
      mutateDashboard();
      toast.success("Dashboard saved successfully");
    } catch (error) {
      recordError("create_dashboard");
      showErrorToast(error, "Failed to save dashboard");
    }
  };

  const toggleEditingName = () => {
    setIsEditingName(!isEditingName);
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDashboardName(e.target.value);
  };

  return (
    <div
      className={`flex flex-col h-full relative ${
        isSettingsOpen ? "pr-80" : ""
      }`}
      data-cy="dashboard-page"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="relative">
          {isEditingName ? (
            <TextInput
              value={dashboardName}
              onChange={handleNameChange}
              onBlur={toggleEditingName}
              placeholder="Dashboard Name"
              className="border-orange-500 focus:border-orange-600 focus:ring-orange-600"
              data-cy="dashboard-name-input"
            />
          ) : (
            <Subtitle color="orange" className="mr-2" data-cy="dashboard-name">
              {dashboardName}
            </Subtitle>
          )}
          <Icon
            size="xs"
            icon={FiEdit2}
            onClick={toggleEditingName}
            className="cursor-pointer absolute right-0 top-0 transform -translate-y-1/2 translate-x-1/2 text-sm"
            color="orange"
            data-cy="dashboard-edit-btn"
          />
        </div>
        <div className="flex gap-1 items-end">
          <GenericFilters filters={DASHBOARD_FILTERS} />
          <div className="flex">
            <Button
              icon={FiSave}
              color="orange"
              size="sm"
              onClick={handleSaveDashboard}
              tooltip="Save current dashboard"
              data-cy="dashboard-save-layout-btn"
            />
            <Button color="orange" onClick={openModal} className="ml-2" data-cy="dashboard-add-widget-btn">
              Add Widget
            </Button>
            <Button
              color="orange"
              variant="secondary"
              icon={FiSliders}
              onClick={openSettings}
              className="ml-2"
              tooltip="Customize this dashboard"
              data-cy="dashboard-customize-btn"
            >
              Customize
            </Button>
          </div>
        </div>
      </div>
      {layout.length === 0 ? (
        <Card
          className="w-full h-full flex items-center justify-center cursor-pointer"
          onClick={openModal}
          data-cy="dashboard-empty-state"
          style={
            appearance.backgroundColor
              ? { backgroundColor: appearance.backgroundColor }
              : undefined
          }
        >
          <div className="text-center">
            <p className="text-lg font-medium">No widgets available</p>
            <p className="text-gray-500">Click to add your first widget</p>
          </div>
        </Card>
      ) : (
        <Card
          className="w-full h-full overflow-auto"
          data-cy="dashboard-grid-container"
          style={
            appearance.backgroundColor
              ? { backgroundColor: appearance.backgroundColor }
              : undefined
          }
        >
          <GridLayout
            layout={layout}
            onLayoutChange={handleLayoutChange}
            data={widgetData}
            onEdit={handleEditWidget}
            onDelete={handleDeleteWidget}
            onSave={handleSaveEdit}
            presets={allPresets}
            metrics={allMetricWidgets}
            density={appearance.density}
          />
        </Card>
      )}
      {isModalOpen && (
        <WidgetModal
          isOpen={true}
          onClose={closeModal}
          onAddWidget={handleAddWidget}
          onEditWidget={handleSaveEdit}
          presets={allPresets}
          editingItem={editingItem}
          metricWidgets={allMetricWidgets}
        />
      )}
      {isSettingsOpen && (
        <DashboardSettingsPanel
          appearance={appearance}
          onChange={setAppearance}
          onReset={resetAppearance}
          onCancel={cancelSettings}
          onClose={closeSettings}
        />
      )}
    </div>
  );
};

export default DashboardPage;
