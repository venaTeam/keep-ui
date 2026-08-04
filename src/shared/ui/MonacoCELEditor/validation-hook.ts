import { useApi } from "@/shared/lib/hooks/useApi";
import { useDebouncedValue } from "@/utils/hooks/useDebouncedValue";
import { editor } from "monaco-editor";
import { useMemo } from "react";
import useSWR from "swr";

interface CelExpressionValidationMarker {
  columnStart: number;
  columnEnd: number;
}

export interface CelValidationState {
  markers: editor.IMarkerData[];
  /** While true, `markers` describes an older expression, so an empty
   * array does not mean "valid". */
  isValidating: boolean;
}

export function useCelValidation(cel: string | undefined): CelValidationState {
  const api = useApi();
  const uri = `/cel/validate`;
  const [debouncedCel] = useDebouncedValue(cel, 500);

  const { data, isLoading } = useSWR<CelExpressionValidationMarker[]>(
    () => (api.isReady() && debouncedCel ? uri + debouncedCel : null),
    () => {
      if (!debouncedCel) {
        return [];
      }

      return api.post(uri, { cel: debouncedCel });
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: false,
    }
  );

  // The SWR key follows the debounced value, so anything typed since then has
  // not reached the backend yet.
  const isValidating = cel !== debouncedCel || isLoading;

  const markers: editor.IMarkerData[] = useMemo(() => {
    if (!data || !debouncedCel) {
      return [];
    }

    return data.map((marker) => ({
      severity: 8, // 8 is error
      startLineNumber: 1,
      endLineNumber: 1,
      startColumn: Math.max(marker.columnStart - 1, 0),
      endColumn: Math.min(marker.columnEnd + 1, debouncedCel.length),
      message: "The error is found at this position",
      source: "CEL",
    }));
  }, [data, debouncedCel]);

  return {
    markers: isValidating ? [] : markers,
    isValidating,
  };
}
