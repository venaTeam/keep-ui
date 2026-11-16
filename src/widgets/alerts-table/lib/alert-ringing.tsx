import React, { type CSSProperties, type ReactNode, useCallback } from "react";
import clsx from "clsx";
import { Severity, Status } from "@/entities/alerts/model/types";
import {
  DEFAULT_BLINK_COLOR,
  getRowBlinkStyle,
} from "@/shared/lib/blink-palette";
import { useSyncedAnimation } from "@/shared/lib/hooks/useSyncedAnimation";

/** What assistive tech is told about a ringing row, which colour and motion alone don't convey. */
export const RINGING_REASON = "Ringing: critical, firing, noisy preset";

const RINGING_CELL_CLASS_NAME = clsx(
  "isolate [&:not(.sticky)]:relative",
  "before:pointer-events-none before:absolute before:inset-0 before:-z-10",
  "before:border-y-2 before:border-[color:var(--blink-row-edge)] before:bg-[color:var(--blink-row-tint)]",
  "motion-safe:before:animate-ringing-pulse"
);

const RINGING_STYLE = getRowBlinkStyle(DEFAULT_BLINK_COLOR);

const REASON = <span className="sr-only">{RINGING_REASON}</span>;

type RingingAlert = {
  severity?: unknown;
  status?: unknown;
  deleted?: unknown;
};

type RingingCellProps = {
  className?: string;
  style?: CSSProperties;
  ref?: (element: HTMLElement | null) => void;
};

/** How one row renders: quiet, which is exactly as before, or ringing. */
export type RingingRow = {
  /** For the row element: `data-ringing="true"` when the row rings. */
  rowProps: { "data-ringing"?: "true" };
  /** For the cell at `index` of the row's `count` cells. */
  cellProps: (index: number, count: number) => RingingCellProps;
  /** The visually hidden reason for the row's first cell; null when quiet. */
  reason: ReactNode;
};

const QUIET_ROW: RingingRow = {
  rowProps: {},
  cellProps: () => ({}),
  reason: null,
};

/**
 * Whether an alert's row rings: the table's preset is noisy and the alert is
 * one that makes the preset's alarm sound, i.e. it matches `NOISE_BASE_CEL`
 * in `features/presets/custom-preset-links/ui/PresetsNoise.tsx`
 * (`status == 'firing' && deleted == false && severity == 'critical'`).
 * Keep the two in step. The match is exact and case-sensitive, like the
 * alarm's: the gateway's `POST /alerts/query` sends severity and status as
 * the lowercase words of its enums, never numbers, and the alarm compares
 * the stored lowercase values with `=`. Only `deleted === true` counts as
 * deleted.
 */
export function isAlertRinging(
  alert: RingingAlert | null | undefined,
  presetNoisy?: boolean
): boolean {
  return (
    !!presetNoisy &&
    alert?.severity === Severity.Critical &&
    alert.status === Status.Firing &&
    alert.deleted !== true
  );
}

/**
 * The ringing wiring for every row of a table whose preset is `presetNoisy`.
 * Returns a function that tells how the row of one alert, or of a group of
 * alerts (it rings when any of them does), renders.
 *
 * A ringing cell keeps its own background (hover, last viewed, selection) and
 * gets an overlay behind its content: a 10% tint of the blink red with a solid
 * red edge on the top and bottom, and on the left of the first cell and the
 * right of the last, so the cells read as one row. Only the overlay's opacity
 * pulses, in step with the page's other blinks; under reduced motion it holds
 * still. A cell that is not sticky is made `relative` to hold the overlay.
 */
export function useRingingRows(presetNoisy: boolean) {
  const syncPulse = useSyncedAnimation(presetNoisy, "::before");

  return useCallback(
    (alerts: RingingAlert | RingingAlert[]): RingingRow => {
      const ringing = (Array.isArray(alerts) ? alerts : [alerts]).some(
        (alert) => isAlertRinging(alert, presetNoisy)
      );
      if (!ringing) {
        return QUIET_ROW;
      }
      return {
        rowProps: { "data-ringing": "true" },
        cellProps: (index, count) => ({
          className: clsx(
            RINGING_CELL_CLASS_NAME,
            index === 0 && "before:border-l-2",
            index === count - 1 && "before:border-r-2"
          ),
          style: RINGING_STYLE,
          ref: syncPulse,
        }),
        reason: REASON,
      };
    },
    [presetNoisy, syncPulse]
  );
}
