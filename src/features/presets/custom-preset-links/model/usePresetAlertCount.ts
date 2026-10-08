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

  const { data, error, isLoading, mutate } = useSWR<number>(
    swrKey,
    () => api.post(requestUrl, query),
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
