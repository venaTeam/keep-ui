import { useCallback } from "react";
import { useRevalidateMultiple } from "@/shared/lib/state-utils";

/** Returns a callback that revalidates every alerts query and the preset counters by key prefix. */
export function useRefreshAlertQueries(): () => void {
  const revalidateMultiple = useRevalidateMultiple();
  return useCallback(
    () => revalidateMultiple(["/alerts/query", "/preset"]),
    [revalidateMultiple]
  );
}
