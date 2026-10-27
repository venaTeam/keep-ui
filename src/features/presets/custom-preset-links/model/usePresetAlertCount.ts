import { useApi } from "@/shared/lib/hooks/useApi";
import useSWR from "swr";
import { useEffect, useMemo } from "react";
import { buildPresetAlertCel } from "./usePresetAlertsCount";
import {
  CountByField,
  DEFAULT_INCIDENT_STATUS,
  IncidentStatusFilter,
} from "@/entities/presets/model/count-by";

type UsePresetAlertCountParams = {
  presetCel: string;
  counterShowsFiringOnly: boolean;
  groupBy?: CountByField;
  incidentStatus?: IncidentStatusFilter;
  refreshInterval?: number;
  enabled?: boolean;
};

/**
 * Returns the count carried by a grouped response, refusing any answer that
 * does not echo the requested grouping. A gateway that predates grouped
 * counts ignores `group_by` and replies with the plain alert count, which
 * must not be shown as a distinct count.
 */
const confirmGroupedCount = (response: unknown, groupBy: CountByField) => {
  if (
    typeof response !== "object" ||
    response === null ||
    typeof (response as { count?: unknown }).count !== "number" ||
    (response as { group_by?: unknown }).group_by !== groupBy
  ) {
    throw new Error("The gateway did not confirm the requested group_by");
  }
  return (response as { count: number }).count;
};

export const usePresetAlertCount = ({
  presetCel,
  counterShowsFiringOnly,
  groupBy,
  incidentStatus,
  refreshInterval,
  enabled = true,
}: UsePresetAlertCountParams) => {
  const api = useApi();
  const requestUrl = "/alerts/query/count";
  const query = useMemo(
    () =>
      enabled
        ? {
            cel: buildPresetAlertCel(presetCel, counterShowsFiringOnly),
            ...(groupBy ? { group_by: groupBy } : {}),
            ...(groupBy === "incident"
              ? { incident_status: incidentStatus ?? DEFAULT_INCIDENT_STATUS }
              : {}),
          }
        : undefined,
    [counterShowsFiringOnly, enabled, groupBy, incidentStatus, presetCel]
  );

  const swrKey = () =>
    api.isReady() && query
      ? requestUrl +
        Object.entries(query)
          .sort(([fstKey], [scdKey]) => fstKey.localeCompare(scdKey))
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join("&")
      : null;

  const fetchCount = async () => {
    const response = await api.post(requestUrl, query);
    return groupBy ? confirmGroupedCount(response, groupBy) : response;
  };

  const { data, error, isLoading, mutate } = useSWR<number>(
    swrKey,
    fetchCount,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!refreshInterval || !enabled) {
      return;
    }

    const intervalId = setInterval(() => mutate(), refreshInterval);
    return () => clearInterval(intervalId);
  }, [enabled, mutate, refreshInterval]);

  const isError = Boolean(groupBy) && Boolean(error);

  return {
    totalCount: data ?? 0,
    isLoading: isLoading && !isError,
    isError,
  };
};
