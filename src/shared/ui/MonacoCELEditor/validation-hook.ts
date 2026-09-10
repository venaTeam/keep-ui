import { useApi } from "@/shared/lib/hooks/useApi";
import { useDebouncedValue } from "@/utils/hooks/useDebouncedValue";
import { editor } from "monaco-editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CEL_VALIDATE_URL,
  CelValidationContext,
  CelValidationState,
  CelValidationResponse,
  diagnosticsToMarkers,
} from "./cel-validation";

/** Only used by editors that validate while typing (see `validateWhileTyping`). */
const DEBOUNCE_MS = 500;

/**
 * How many completed verdicts one editor remembers.
 *
 * A verdict for an exact (context, expression) pair is deterministic, so asking
 * twice is pure waste - pressing Enter on a draft the editor already checked,
 * or retyping an earlier one, costs no request. The cache lives on the hook
 * instance, so it dies with the editor and can never outlive the session or
 * tenant it was filled for.
 */
const MAX_REMEMBERED_VERDICTS = 50;

const EMPTY_EXPRESSION_RESULT: CelValidationResponse = {
  valid: true,
  diagnostics: [],
};

const verdictKey = (cel: string, context: CelValidationContext) =>
  `${context} ${cel}`;

export interface UseCelValidationOptions {
  /**
   * Validate as the user types, debounced.
   *
   * Off by default: an editor with an apply gesture asks once, when the user
   * commits, rather than on every pause in typing. Turn it on only for editors
   * that have no such gesture (the maintenance form, the workflow trigger) -
   * there the typing *is* the commit, so nothing else would trigger a check.
   */
  validateWhileTyping?: boolean;
}

export interface UseCelValidationResult extends CelValidationState {
  markers: editor.IMarkerData[];
  /**
   * Validate `cel` and resolve with the verdict for *that* draft. Rejects if the
   * request itself failed - a service failure is not a verdict.
   *
   * Returns a remembered verdict without a request when this editor has already
   * checked the exact same expression.
   */
  validateNow: (cel: string) => Promise<CelValidationResponse>;
}

/**
 * Server-backed validation state for a CEL draft.
 *
 * The state always describes the draft named in `cel` - the last one checked,
 * which is not necessarily the text on screen. Callers must compare it against
 * their own draft before acting on it; a response for an older draft must never
 * decide the fate of a newer one.
 */
export function useCelValidation(
  cel: string | undefined,
  context: CelValidationContext,
  { validateWhileTyping = false }: UseCelValidationOptions = {}
): UseCelValidationResult {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;

  const [state, setState] = useState<CelValidationState>({
    cel: "",
    context,
    status: "unchecked",
    diagnostics: [],
  });

  const rememberedRef = useRef(new Map<string, CelValidationResponse>());
  /** Only the newest request may write state; older answers are dropped. */
  const latestRequestRef = useRef(0);

  const remember = useCallback((key: string, response: CelValidationResponse) => {
    const remembered = rememberedRef.current;

    if (remembered.size >= MAX_REMEMBERED_VERDICTS) {
      const oldest = remembered.keys().next().value;
      if (oldest !== undefined) {
        remembered.delete(oldest);
      }
    }

    remembered.set(key, response);
  }, []);

  const validateNow = useCallback(
    async (celToValidate: string): Promise<CelValidationResponse> => {
      // An empty expression is not a filter, so there is nothing to ask about.
      if (!celToValidate) {
        latestRequestRef.current += 1;
        setState({
          cel: celToValidate,
          context,
          status: "valid",
          diagnostics: [],
        });
        return EMPTY_EXPRESSION_RESULT;
      }

      const key = verdictKey(celToValidate, context);
      const remembered = rememberedRef.current.get(key);

      if (remembered) {
        latestRequestRef.current += 1;
        setState(toState(celToValidate, context, remembered));
        return remembered;
      }

      const requestId = ++latestRequestRef.current;

      setState({
        cel: celToValidate,
        context,
        status: "validating",
        diagnostics: [],
      });

      if (!apiRef.current.isReady()) {
        // Validity is unknown, which is not permission to proceed.
        setState({
          cel: celToValidate,
          context,
          status: "failed",
          diagnostics: [],
        });
        throw new Error("Cannot validate CEL: the API client is not ready");
      }

      try {
        const response = await apiRef.current.post<CelValidationResponse>(
          CEL_VALIDATE_URL,
          { cel: celToValidate, context }
        );

        remember(key, response);

        if (latestRequestRef.current === requestId) {
          setState(toState(celToValidate, context, response));
        }

        return response;
      } catch (error) {
        if (latestRequestRef.current === requestId) {
          setState({
            cel: celToValidate,
            context,
            status: "failed",
            diagnostics: [],
            error,
          });
        }

        // Rethrown so the caller can tell "could not check" from "invalid".
        throw error;
      }
    },
    [context, remember]
  );

  const [debouncedCel] = useDebouncedValue(cel, DEBOUNCE_MS);

  useEffect(() => {
    if (!validateWhileTyping) {
      return;
    }

    // A failure is already reflected in `state`; nothing else to do with it here.
    void validateNow(debouncedCel ?? "").catch(() => {});
  }, [validateWhileTyping, debouncedCel, validateNow]);

  return useMemo<UseCelValidationResult>(
    () => ({
      ...state,
      markers:
        state.status === "invalid"
          ? diagnosticsToMarkers(state.diagnostics)
          : [],
      validateNow,
    }),
    [state, validateNow]
  );
}

function toState(
  cel: string,
  context: CelValidationContext,
  response: CelValidationResponse
): CelValidationState {
  // `valid` comes from the response body. An empty diagnostics array is never
  // read as evidence of validity on its own.
  return {
    cel,
    context,
    status: response.valid ? "valid" : "invalid",
    diagnostics: response.valid ? [] : response.diagnostics ?? [],
  };
}
