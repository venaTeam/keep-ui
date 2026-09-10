import { useApi } from "@/shared/lib/hooks/useApi";
import { useDebouncedValue } from "@/utils/hooks/useDebouncedValue";
import { editor } from "monaco-editor";
import { useCallback, useMemo, useRef } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  CEL_VALIDATE_URL,
  CelValidationContext,
  CelValidationState,
  CelValidationResponse,
  diagnosticsToMarkers,
} from "./cel-validation";

/** Editor feedback stays debounced; an apply attempt bypasses it. */
const DEBOUNCE_MS = 500;

/**
 * SWR key for one exact draft in one context.
 *
 * The draft is part of the key so a response can never be attributed to a
 * different expression, and the context is part of it so an `alerts` verdict is
 * never reused for a `maintenance` check of the same text.
 */
const cacheKey = (cel: string, context: CelValidationContext) =>
  `${CEL_VALIDATE_URL}?context=${context}&cel=${cel}`;

export interface UseCelValidationResult extends CelValidationState {
  markers: editor.IMarkerData[];
  /**
   * Validate `cel` immediately, without waiting for the typing debounce, and
   * resolve with the verdict for *that* draft. Rejects if the request itself
   * failed - a service failure is not a verdict.
   */
  validateNow: (cel: string) => Promise<CelValidationResponse>;
}

/**
 * Server-backed validation state for the current draft.
 *
 * The state always describes the draft named in `cel`, which lags the text the
 * user is typing by the debounce. Callers must compare it against their own
 * draft before acting on it; a response for an older draft must never decide
 * the fate of a newer one.
 */
export function useCelValidation(
  cel: string | undefined,
  context: CelValidationContext
): UseCelValidationResult {
  const api = useApi();
  const { mutate } = useSWRConfig();
  const [debouncedCel] = useDebouncedValue(cel, DEBOUNCE_MS);
  const draft = debouncedCel ?? "";

  const fetcher = useCallback(
    (celToValidate: string): Promise<CelValidationResponse> =>
      api.post(CEL_VALIDATE_URL, { cel: celToValidate, context }),
    [api, context]
  );

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const isEnabled = api.isReady() && Boolean(draft);

  const { data, error, isLoading } = useSWR<CelValidationResponse>(
    () => (isEnabled ? cacheKey(draft, context) : null),
    () => fetcherRef.current(draft),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: false,
      /**
       * A rejected expression is deterministic - retrying re-asks a question
       * that already has an answer. Only transport failures are worth a retry,
       * and those surface as a request error rather than a 200 body.
       */
      shouldRetryOnError: true,
    }
  );

  const validateNow = useCallback(
    async (celToValidate: string) => {
      if (!celToValidate) {
        // An empty alert search is not a filter; nothing to ask the server.
        return { valid: true, diagnostics: [] };
      }

      /**
       * Written through SWR so the background hook picks up the same answer for
       * the same draft instead of issuing a second request for it.
       */
      return (await mutate(
        cacheKey(celToValidate, context),
        fetcherRef.current(celToValidate),
        { revalidate: false }
      )) as CelValidationResponse;
    },
    [mutate, context]
  );

  return useMemo<UseCelValidationResult>(() => {
    const base = { cel: draft, context };

    if (!draft) {
      // Empty is a valid alert search - it simply applies no filter.
      return {
        ...base,
        status: "valid",
        diagnostics: [],
        markers: [],
        validateNow,
      };
    }

    if (error) {
      // Validity is unknown, not false: never render this as a syntax error and
      // never let it enable a submit.
      return {
        ...base,
        status: "failed",
        diagnostics: [],
        markers: [],
        error,
        validateNow,
      };
    }

    if (isLoading || !data) {
      return {
        ...base,
        status: isLoading ? "validating" : "unchecked",
        diagnostics: [],
        markers: [],
        validateNow,
      };
    }

    // `valid` comes from the response body. An empty marker array is not
    // evidence of validity, so it is never used as such.
    const diagnostics = data.valid ? [] : data.diagnostics ?? [];

    return {
      ...base,
      status: data.valid ? "valid" : "invalid",
      diagnostics,
      markers: diagnosticsToMarkers(diagnostics),
      validateNow,
    };
  }, [draft, context, data, error, isLoading, validateNow]);
}
