import { useApi } from "@/shared/lib/hooks/useApi";
import useSWR from "swr";
import { useEffect, useMemo } from "react";
import { buildPresetAlertCel } from "./usePresetAlertsCount";

type UsePresetAlertCountParams = {
  presetCel: string;
  counterShowsFiringOnly: boolean;
  refreshInterval?: number;
  enabled?: boolean;
};

export const usePresetAlertCount = ({
  presetCel,
  counterShowsFiringOnly,
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
          }
        : undefined,
    [counterShowsFiringOnly, enabled, presetCel]
  );

  const swrKey = () =>
    api.isReady() && query
      ? requestUrl +
        Object.entries(query)
          .sort(([fstKey], [scdKey]) => fstKey.localeCompare(scdKey))
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join("&")
      : null;

  const { data, isLoading, mutate } = useSWR<number>(
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

  return { totalCount: data ?? 0, isLoading };
};
