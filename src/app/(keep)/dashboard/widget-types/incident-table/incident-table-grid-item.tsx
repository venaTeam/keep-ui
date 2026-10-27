import React from "react";
import { Button } from "@tremor/react";
import { startCase } from "lodash";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import TimeAgo from "react-timeago";
import { useRouter } from "next/navigation";
import { IncidentDto } from "@/entities/incidents/model";
import { getIncidentName } from "@/entities/incidents/lib/utils";
import { SeverityBorderIcon, UISeverity } from "@/shared/ui";
import { useIncidents } from "@/utils/hooks/useIncidents";
import { IncidentTableColumn, WidgetData } from "../../types";
import {
  DEFAULT_INCIDENT_TABLE_CONFIG,
  INCIDENT_TABLE_COLUMNS,
  buildIncidentTableCel,
  buildIncidentsPageUrl,
  describeIncidentTableFilters,
  getIncidentTicketLink,
  orderIncidentTableColumns,
  toPlainText,
} from "./incident-table-config";

const REFRESH_INTERVAL_MS = 30000;
const SKELETON_ROW_COUNT = 5;
const INCIDENTS_SWR_OPTIONS = {
  refreshInterval: REFRESH_INTERVAL_MS,
  revalidateOnFocus: false,
};

const COLUMN_GRID_TEMPLATES: Record<IncidentTableColumn, string> = {
  status: "min-content",
  severity: "min-content",
  name: "minmax(100px, 1fr)",
  description: "minmax(100px, 1fr)",
  alertsCount: "min-content",
  creationTime: "min-content",
  snLink: "min-content",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  firing: "bg-red-100 text-red-700",
  acknowledged: "bg-blue-100 text-blue-700",
  suppressed: "bg-gray-200 text-gray-600",
};

const columnsGapClass = "pr-3";
const borderClass = "border-b";

function renderCell(column: IncidentTableColumn, incident: IncidentDto) {
  switch (column) {
    case "status":
      return (
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[incident.status] ?? "bg-gray-100 text-gray-600"}`}
        >
          {startCase(incident.status)}
        </span>
      );
    case "severity":
      return (
        <div className="flex items-center gap-1.5">
          <SeverityBorderIcon
            severity={incident.severity as unknown as UISeverity}
          />
          <span>{startCase(incident.severity)}</span>
        </div>
      );
    case "name": {
      const name = getIncidentName(incident);
      return (
        <div title={name} className="truncate select-text">
          {name}
        </div>
      );
    }
    case "description": {
      const description = toPlainText(
        incident.user_summary || incident.generated_summary
      );
      return (
        <div title={description} className="truncate select-text">
          {description}
        </div>
      );
    }
    case "alertsCount":
      return <span>{incident.alerts_count}</span>;
    case "creationTime":
      return (
        <TimeAgo
          date={incident.creation_time}
          title={new Date(incident.creation_time).toLocaleString()}
        />
      );
    case "snLink": {
      const ticket = getIncidentTicketLink(incident);
      if (ticket && /^https?:\/\//i.test(ticket.url)) {
        return (
          <a
            href={ticket.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-orange-600 hover:underline"
          >
            {ticket.label}
            <span aria-hidden="true"> ↗</span>
          </a>
        );
      }
      return <span className="text-gray-400">—</span>;
    }
  }
}

/**
 * Lists the newest incidents matching the widget's status and severity
 * selection, refreshing every 30 seconds. The dashboard time filter does not
 * apply. Rows open the incident and the button opens the filtered Incidents
 * page.
 */
export default function IncidentTableGridItem({ item }: { item: WidgetData }) {
  const router = useRouter();
  const config = item.incidentTable ?? DEFAULT_INCIDENT_TABLE_CONFIG;
  const { data, isLoading, error } = useIncidents(
    {
      candidate: null,
      predicted: null,
      limit: config.limit,
      offset: 0,
      sorting: { id: "creation_time", desc: true },
      cel: buildIncidentTableCel(config),
    },
    INCIDENTS_SWR_OPTIONS
  );

  const columns = orderIncidentTableColumns(config.columns);
  const gridTemplateColumns = columns
    .map((column) => COLUMN_GRID_TEMPLATES[column])
    .join(" ");
  const failed = !!error && !data;
  const incidents = data?.items ?? [];
  const count = data?.count ?? 0;

  const gapClass = (index: number) =>
    index < columns.length - 1 ? columnsGapClass : "";

  const renderCountText = () => {
    if (isLoading) {
      return <Skeleton containerClassName="h-4 w-8 relative -top-0.5" />;
    }
    if (failed) {
      return <span>—</span>;
    }
    if (count > config.limit) {
      return (
        <span>
          showing {config.limit} out of {count}
        </span>
      );
    }
    return <span>{count}</span>;
  };

  const renderBody = () => {
    if (isLoading) {
      return Array.from({ length: SKELETON_ROW_COUNT }, (_, rowIndex) => (
        <div
          key={rowIndex}
          role="row"
          className="contents"
          data-testid="incident-table-skeleton-row"
        >
          {columns.map((column, index) => (
            <div
              key={column}
              role="cell"
              className={`min-h-7 text-xs flex min-w-0 items-center overflow-hidden whitespace-nowrap ${rowIndex < SKELETON_ROW_COUNT - 1 ? borderClass : ""} ${gapClass(index)}`}
            >
              <Skeleton containerClassName="w-full" />
            </div>
          ))}
        </div>
      ));
    }
    return incidents.map((incident, rowIndex) => (
      <div
        key={incident.id}
        role="row"
        className="contents"
        onClick={() => router.push(`/incidents/${incident.id}/alerts`)}
      >
        {columns.map((column, index) => (
          <div
            key={column}
            role="cell"
            className={`min-h-7 text-xs flex min-w-0 items-center overflow-hidden whitespace-nowrap select-text cursor-pointer ${rowIndex < incidents.length - 1 ? borderClass : ""} ${gapClass(index)}`}
          >
            {renderCell(column, incident)}
          </div>
        ))}
      </div>
    ));
  };

  const renderTable = () => (
    <div className="max-w-full min-h-0 overflow-auto border rounded-md">
      <div
        role="table"
        style={{ gridTemplateColumns }}
        className="grid min-w-fit px-2"
      >
        <div role="row" className="contents">
          {columns.map((column, index) => (
            <div
              key={column}
              role="columnheader"
              className={`flex h-6 items-center whitespace-nowrap text-xs font-bold ${borderClass} ${gapClass(index)}`}
            >
              {INCIDENT_TABLE_COLUMNS.find((c) => c.id === column)?.header}
            </div>
          ))}
        </div>
        {renderBody()}
      </div>
    </div>
  );

  const filters = describeIncidentTableFilters(config);

  return (
    <div
      className="flex flex-col flex-1 min-h-0 gap-1"
      data-cy="dashboard-widget-incident-table"
    >
      <div className="flex gap-2">
        <div className="flex-1 min-w-0 overflow-hidden whitespace-nowrap">
          <div className="flex gap-1 items-center">
            <div>Incidents count:</div>
            <div className="flex items-center text-base font-bold">
              {renderCountText()}
            </div>
          </div>
          <div className="truncate text-xs text-gray-500" title={filters}>
            {filters}
          </div>
        </div>
        <div className="flex items-center">
          <Button
            color="orange"
            variant="secondary"
            size="xs"
            onClick={() => router.push(buildIncidentsPageUrl(config))}
            data-cy="dashboard-widget-incident-table-go-btn"
          >
            Go to INC page
          </Button>
        </div>
      </div>
      {failed ? (
        <div className="py-4 text-center text-sm text-gray-500">
          Couldn&apos;t load incidents
        </div>
      ) : !isLoading && incidents.length === 0 ? (
        <div className="py-4 text-center text-sm text-gray-500">
          No incidents match these filters
        </div>
      ) : (
        renderTable()
      )}
    </div>
  );
}
