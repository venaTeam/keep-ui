import { useCallback } from "react";
import { KeepApiError } from "@/shared/api";
import { useApi } from "@/shared/lib/hooks/useApi";
import { Dashboard, useDashboards } from "@/utils/hooks/useDashboards";
import { recordAction, recordError } from "@/utils/metrics";

/**
 * Duplicates a saved dashboard on the server under a new name, then adds the
 * copy to the dashboards list cache and records the `duplicate_dashboard` metric.
 */
export function useDuplicateDashboard() {
  const api = useApi();
  const { mutate } = useDashboards();

  const duplicateDashboard = useCallback(
    async (sourceId: string, dashboardName: string): Promise<Dashboard> => {
      const start = performance.now();
      try {
        const created = await api.post<Dashboard>(
          `/dashboard/${encodeURIComponent(sourceId)}/duplicate`,
          { dashboard_name: dashboardName.trim() }
        );
        const seconds = (performance.now() - start) / 1000;
        await mutate((current) => [...(current ?? []), created], {
          revalidate: true,
        });
        recordAction("duplicate_dashboard", seconds);
        return created;
      } catch (error) {
        recordError(
          "duplicate_dashboard",
          error instanceof KeepApiError ? error.statusCode : undefined
        );
        throw error;
      }
    },
    [api, mutate]
  );

  const refreshDashboards = useCallback(() => mutate(), [mutate]);

  return { duplicateDashboard, refreshDashboards };
}
