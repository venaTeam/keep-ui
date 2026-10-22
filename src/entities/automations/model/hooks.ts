"use client";
import useSWR, { unstable_serialize, useSWRConfig } from "swr";
import { useRef, useState } from "react";
import { useApi } from "@/shared/lib/hooks/useApi";
import { useConfig } from "@/utils/hooks/useConfig";
import { useHydratedSession } from "@/shared/lib/hooks/useHydratedSession";
import { KeepApiError } from "@/shared/api/KeepApiError";
import { automationKey, isAutomationListKey } from "./automationKeys";
import {
  automationRoutes,
  filterQuery,
  normalizeNamespaces,
} from "./normalize";
import {
  Automation,
  AutomationAction,
  AutomationDetail,
  AutomationFilters,
  LifecycleResponse,
} from "./types";

function useAutomationContext() {
  const api = useApi();
  const { data: config } = useConfig();
  const { data: session, status } = useHydratedSession();
  const scope = JSON.stringify([
    session?.tenantId,
    session?.user?.email,
    session?.userRole,
  ]);
  return {
    api,
    scope,
    ready:
      status === "authenticated" &&
      api.isReady() &&
      !!config?.KEEP_AUTOMATIONS_ENABLED,
  };
}
const changing = (row: Automation) =>
  row.build_state === "building" || row.matching_state === "deleting";
const options = {
  revalidateOnFocus: true,
  refreshWhenHidden: false,
  shouldRetryOnError: false,
};
export function useAutomations(filters: AutomationFilters) {
  const { api, scope, ready } = useAutomationContext();
  const path = automationRoutes.list(filterQuery(filters));
  return useSWR<Automation[]>(
    ready ? automationKey(scope, path) : null,
    async () =>
      (await api.get<{ automations: Automation[] }>(path)).automations,
    { ...options, refreshInterval: (rows) => (rows?.some(changing) ? 5000 : 0) }
  );
}
export function useAutomationDetail(id: string) {
  const { api, scope, ready } = useAutomationContext();
  const path = automationRoutes.detail(id);
  return useSWR<AutomationDetail>(
    ready ? automationKey(scope, path) : null,
    () => api.get(path),
    { ...options, refreshInterval: (row) => (row && changing(row) ? 5000 : 0) }
  );
}
export function useAutomationNamespaces() {
  const { api, scope, ready } = useAutomationContext();
  return useSWR<string[]>(
    ready ? automationKey(scope, "/automation-namespaces") : null,
    async () => normalizeNamespaces(await api.get("/automation-namespaces")),
    options
  );
}
export function automationError(error: unknown): string {
  if (error instanceof KeepApiError) {
    const fields = error.responseJson?.errors;
    if (error.statusCode === 400 && Array.isArray(fields))
      return fields
        .map(
          (field: { field: string; message: string }) =>
            `${field.field}: ${field.message}`
        )
        .join("; ");
    if (error.statusCode === 401) return "Please sign in again.";
    if (error.statusCode === 403)
      return "You do not have permission to perform this action.";
    if (error.statusCode === 404) return "Automation unavailable or not found.";
    if (error.statusCode === 409)
      return "The automation changed or is building. Its state has been refreshed; review it before retrying.";
    if (error.statusCode === 503)
      return "The automation service is unavailable. Refresh the state before retrying.";
  }
  return "The request could not be completed. Refresh the state before retrying.";
}
export function useAutomationActions(id: string) {
  const { api, scope, ready } = useAutomationContext();
  const { mutate, cache } = useSWRConfig();
  const path = automationRoutes.detail(id);
  const key = automationKey(scope, path);
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const refresh = async () => {
    const listKeys: string[] = [];
    await Promise.all([
      mutate(key),
      mutate((candidate) => {
        const matches = isAutomationListKey(candidate, scope);
        if (matches) {
          listKeys.push(
            typeof candidate === "string"
              ? candidate
              : unstable_serialize(candidate)
          );
        }
        return matches;
      }),
    ]);
    if (
      [unstable_serialize(key), ...listKeys].some(
        (cacheKey) => cache.get(cacheKey)?.error
      )
    )
      throw new Error("Refresh failed");
    setNeedsRefresh(false);
  };
  async function run(action: AutomationAction) {
    if (!ready || lock.current || needsRefresh) return false;
    lock.current = true;
    setPending(true);
    setMessage(undefined);
    let succeeded = false;
    try {
      const result =
        action === "delete"
          ? await api.delete<LifecycleResponse>(path)
          : await api.post<LifecycleResponse>(`${path}/${action}`);
      succeeded = true;
      await mutate(
        key,
        (current: AutomationDetail | undefined) =>
          current ? { ...current, ...result } : current,
        { revalidate: false }
      );
      setMessage(
        action === "delete"
          ? result.matching_state === "deleted"
            ? "Deletion completed"
            : "Deletion started"
          : action === "enable"
            ? "Automation enabled"
            : "Automation disabled"
      );
      try {
        await refresh();
      } catch {
        setNeedsRefresh(true);
        setMessage(
          "Action succeeded, but refreshing failed. Refresh to see the latest state."
        );
      }
    } catch (error) {
      setMessage(automationError(error));
      // Never replay an ambiguous write. Read its state before offering a retry.
      try {
        await refresh();
      } catch {
        setNeedsRefresh(true);
        setMessage(
          `${automationError(error)} The latest state could not be loaded.`
        );
      }
    } finally {
      lock.current = false;
      setPending(false);
    }
    return succeeded;
  }
  const retryRefresh = async () => {
    setPending(true);
    try {
      await refresh();
      setMessage("Automation state refreshed.");
    } catch {
      setMessage(
        "The latest state could not be loaded. Refresh before retrying an action."
      );
    } finally {
      setPending(false);
    }
  };
  return { run, pending, message, needsRefresh, retryRefresh };
}
