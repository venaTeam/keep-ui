import { AlertToWorkflowExecution } from "@/entities/alerts/model";
import useSWR, { SWRConfiguration } from "swr";
import { useApi } from "@/shared/lib/hooks/useApi";

/**
 * @deprecated Use useWorkflowExecutionsV2 instead.
 * @param enabled When false, nothing is fetched and `data` stays undefined.
 */
export const useWorkflowExecutions = (
  options: SWRConfiguration = {
    revalidateOnFocus: false,
  },
  enabled: boolean = true
) => {
  const api = useApi();

  return useSWR<AlertToWorkflowExecution[]>(
    enabled && api.isReady() ? "/workflows/executions" : null,
    (url) => api.get(url),
    options
  );
};
