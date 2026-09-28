import { Preset } from "@/entities/presets/model";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useApi } from "@/shared/lib/hooks/useApi";
import useSWR from "swr";
// Using dynamic import to avoid hydration issues with react-player
import dynamic from "next/dynamic";
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });
import { usePathname } from "next/navigation";
import { useDashboards } from "@/utils/hooks/useDashboards";
import { useAlertPolling } from "@/utils/hooks/useAlertPolling";
import { useConfig } from "@/utils/hooks/useConfig";
import {
  RefetchTimers,
  clearRefetchTimers,
  scheduleRefetchWithMaxWait,
} from "@/widgets/alerts-table/lib/refetch-scheduler";

const COUNT_URL = "/alerts/query/count";
const REFRESH_INTERVAL_MS = 30_000;

// The condition the sound is armed on. `dismissed` is deliberately absent: a
// dismissed alert is one whose status is `suppressed`, which `status ==
// 'firing'` already excludes, and the gateway's `dismissed` mapping compares
// text to boolean and answers 500.
const NOISE_BASE_CEL =
  "status == 'firing' && deleted == false && severity == 'critical'";

const getPresetCel = (preset: Preset) =>
  preset.options.find((option) => option.label === "CEL")?.value ?? "";

interface PresetsNoiseProps {
  presets: Preset[];
}

export const PresetsNoise = ({ presets }: PresetsNoiseProps) => {
  const api = useApi();
  const pathname = usePathname();
  const { data: config } = useConfig();
  // Same SWR key the navbar's DashboardLinks already warms, so this is free.
  const { dashboards } = useDashboards();

  // Which noisy presets are on screen right now. Two routes arm the sound: a
  // preset page, and a dashboard carrying a widget that points at a noisy
  // preset.
  const noisyPresets = useMemo(() => {
    const path = pathname || "";

    // Decode only the segment: usePathname() is percent-encoded, while preset
    // names are not, so a preset named "db errors" lives at /alerts/db%20errors.
    const alertsMatch = path.match(/^\/alerts\/(.+)$/);
    if (alertsMatch) {
      const presetName = decodeURIComponent(alertsMatch[1]).toLowerCase();
      const activePreset = presets?.find(
        (preset) => preset.name.toLowerCase() === presetName
      );
      return activePreset?.is_noisy ? [activePreset] : [];
    }

    const dashboardMatch = path.match(/^\/dashboard\/(.+)$/);
    if (dashboardMatch) {
      const dashboardName = decodeURIComponent(dashboardMatch[1]);
      // Resolved the same way the dashboard page itself resolves the route.
      const dashboard = dashboards?.find(
        (item) => item.dashboard_name === dashboardName
      );

      const widgets: any[] = dashboard?.dashboard_config?.widget_data ?? [];
      const presetIds = new Set<string>(
        widgets.map((widget) => widget?.preset?.id).filter(Boolean)
      );

      // Re-resolved against the live preset list rather than the widget's own
      // copy: a whole Preset is serialised into the dashboard config at
      // widget-creation time, so its is_noisy is a snapshot. Un-flagging a
      // preset must silence widgets that already exist.
      return (presets ?? []).filter(
        (preset) => presetIds.has(preset.id) && preset.is_noisy
      );
    }

    return [];
  }, [presets, dashboards, pathname]);

  // One query for every noisy preset on screen, so widget count never drives
  // request count.
  const cel = useMemo(() => {
    if (noisyPresets.length === 0) {
      return null;
    }

    const presetCels = noisyPresets.map(getPresetCel);

    // An empty preset CEL matches every alert, so the OR group is satisfied
    // outright — and emitting `()` would be rejected as a 400.
    if (presetCels.some((presetCel) => !presetCel.trim())) {
      return NOISE_BASE_CEL;
    }

    const presetGroup = presetCels
      .map((presetCel) => `(${presetCel})`)
      .join(" || ");

    return `(${NOISE_BASE_CEL}) && (${presetGroup})`;
  }, [noisyPresets]);

  // /alerts/query/count returns a bare integer, so there is no response shape
  // to misread — unlike /alerts/query, whose `results` is truthy even when empty.
  const { data: matchingCount, mutate } = useSWR<number>(
    () => (api.isReady() && cel ? `${COUNT_URL}?cel=${cel}` : null),
    () => api.post(COUNT_URL, { cel }),
    {
      revalidateOnFocus: false,
      refreshInterval: REFRESH_INTERVAL_MS,
    }
  );

  const shouldDoNoise = (matchingCount ?? 0) > 0;

  const refetchTimersRef = useRef<RefetchTimers>({
    debounce: null,
    maxWait: null,
  });

  useEffect(() => {
    const timers = refetchTimersRef.current;
    return () => clearRefetchTimers(timers);
  }, []);

  const onAlertsChanged = useCallback(
    (data?: any) => {
      // The ingest payload carries each alert's severity; the gateway's and the
      // workflows watcher's emissions carry {} and must always revalidate.
      // A batch with no critical alert cannot change the answer in either
      // direction, because a critical alert that resolves is still serialised
      // with severity 'critical' — only its status changes.
      if (
        Array.isArray(data?.alerts) &&
        !data.alerts.some((alert: any) => alert?.severity === "critical")
      ) {
        return;
      }

      // Paced with the same debounce the alerts table uses on this stream, so a
      // storm cannot turn one query per evaluation into one query per event.
      scheduleRefetchWithMaxWait(
        refetchTimersRef.current,
        () => mutate(),
        config?.ALERT_REFETCH_DEBOUNCE_MS,
        config?.ALERT_REFETCH_MAX_WAIT_MS
      );
    },
    [mutate, config]
  );

  useAlertPolling(noisyPresets.length > 0, onAlertsChanged);

  /* React Player for playing alert sound */
  return (
    <div
      data-testid="noisy-presets-audio-player"
      data-cy="noisy-presets-audio-player"
      className="absolute -z-10"
    >
      <ReactPlayer
        // TODO: cache the audio file fiercely
        url="/music/alert.mp3"
        playing={shouldDoNoise}
        volume={0.5}
        loop={true}
        width="0"
        height="0"
        playsinline
        className="absolute -z-10"
      />
    </div>
  );
};
