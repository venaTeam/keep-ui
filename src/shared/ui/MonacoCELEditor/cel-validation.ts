import type { editor } from "monaco-editor";
import { KeepApiError } from "@/shared/api";

/**
 * The backend is the source of truth for CEL validity. Nothing in this module
 * decides CEL semantics - it carries the server's verdict and renders it.
 */

export const CEL_VALIDATE_URL = "/cel/validate";

/**
 * The editor is shared between features whose execution engines differ, so a
 * check is always made *for a context*. `alerts` filters are converted to SQL
 * and run against the database; the rest are evaluated in-process by celpy over
 * the raw event payload, where any payload key is a legitimate field.
 *
 * There is deliberately no default: an editor must name the engine its
 * expression will actually run on, or it inherits the wrong rules.
 */
export type CelValidationContext =
  | "alerts"
  | "maintenance"
  | "extraction"
  | "rules"
  | "workflows";

export type CelDiagnosticCode =
  | "SYNTAX_ERROR"
  | "EXPECTED_BOOLEAN"
  | "UNKNOWN_FIELD"
  | "UNSUPPORTED_EXPRESSION";

/** One-based coordinates with an exclusive end position, matching Monaco. */
export interface CelDiagnosticRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface CelDiagnostic {
  code: CelDiagnosticCode;
  message: string;
  /** Absent when the failure has no reliable source location. */
  range?: CelDiagnosticRange | null;
}

export interface CelValidationResponse {
  valid: boolean;
  diagnostics: CelDiagnostic[];
}

/**
 * What is known about one exact draft.
 *
 * `unchecked`, `validating` and `failed` are all "not known to be valid" - none
 * of them may be treated as valid. In particular a failed request leaves
 * validity *unknown*; it is not a syntax error and not an approval.
 */
export type CelValidationStatus =
  | "unchecked"
  | "validating"
  | "valid"
  | "invalid"
  | "failed";

export interface CelValidationState {
  /** The draft this state describes. Never assume it is the current text. */
  cel: string;
  context: CelValidationContext;
  status: CelValidationStatus;
  diagnostics: CelDiagnostic[];
}

/** The only invalid-CEL wording the UI shows, everywhere it shows one. */
export const INVALID_CEL_MESSAGE = "Invalid Common Expression Logic expression.";

/**
 * Whether an API error is the backend rejecting the CEL filter itself.
 *
 * Read from the structured body, not from the status code: a 400 can also mean
 * malformed pagination, and a 500 never means the expression was bad.
 */
export function isInvalidCelError(error: unknown): boolean {
  if (!(error instanceof KeepApiError)) {
    return false;
  }

  const detail = error.responseJson?.detail;

  return (
    Boolean(detail) && typeof detail === "object" && detail.code === "INVALID_CEL"
  );
}

/**
 * Turn diagnostics into Monaco markers.
 *
 * Only the *position* is taken from the diagnostic; every marker carries the
 * single user-facing message, so the UI never surfaces the backend's internal
 * wording. A diagnostic without a range gets no marker at all - underlining an
 * arbitrary span would point at the wrong thing.
 */
export function diagnosticsToMarkers(
  diagnostics: CelDiagnostic[]
): editor.IMarkerData[] {
  return diagnostics
    .filter((diagnostic) => Boolean(diagnostic.range))
    .map((diagnostic) => ({
      // 8 is monaco's MarkerSeverity.Error.
      severity: 8,
      startLineNumber: diagnostic.range!.startLine,
      startColumn: diagnostic.range!.startColumn,
      endLineNumber: diagnostic.range!.endLine,
      endColumn: diagnostic.range!.endColumn,
      message: INVALID_CEL_MESSAGE,
      source: "CEL",
    }));
}
