import { useAlerts } from "@/entities/alerts/model/useAlerts";
import { useEffect } from "react";

export const buildPresetAlertCel = (
  presetCel: string,
  counterShowsFiringOnly: boolean
) => {
  const celList = [];

  if (counterShowsFiringOnly) {
    celList.push("status == 'firing'");
  }

  celList.push(presetCel);

  return celList
    .filter((cel) => !!cel)
    .map((cel) => `(${cel})`)
    .join(" && ");
};

export const usePresetAlertsCount = (
  presetCel: string,
  counterShowsFiringOnly: boolean,
  limit = 0,
  offset = 0,
  refreshInterval: number | undefined = undefined,
  enabled: boolean = true
) => {
  const { useLastAlerts } = useAlerts();

  const query = enabled
    ? {
        cel: buildPresetAlertCel(presetCel, counterShowsFiringOnly),
        limit: limit,
        offset: offset,
      }
    : undefined;

  const { data, totalCount, isLoading, mutate } = useLastAlerts(query);

  useEffect(() => {
    if (!refreshInterval || !enabled) {
      return;
    }

    const intervalId = setInterval(() => mutate(), refreshInterval);
    return () => clearInterval(intervalId);
  }, [enabled, mutate, refreshInterval]);

  return { alerts: data, totalCount, isLoading };
};
