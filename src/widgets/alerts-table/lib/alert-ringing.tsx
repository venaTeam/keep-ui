import React, { type CSSProperties, type ReactNode, useCallback } from "react";
import clsx from "clsx";
import { matchesNoiseBase } from "@/entities/presets/model/noise";
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
  "before:border-[color:var(--blink-row-edge)] before:bg-[color:var(--blink-row-tint)]",
  "[tr.group:hover>&]:before:bg-transparent [tr[data-selection]>&]:before:bg-transparent",
  "motion-safe:before:animate-ringing-pulse"
);

const RINGING_STYLE = getRowBlinkStyle(DEFAULT_BLINK_COLOR);

const REASON = <span className="sr-only select-none">{RINGING_REASON}</span>;

type RingingAlert = {
  severity?: unknown;
  status?: unknown;
  deleted?: unknown;
};

type RingingCellProps = {
  className?: string;
  ref?: (element: HTMLElement | null) => void;
};

/** How one row renders: quiet, which is exactly as before, or ringing. */
export type RingingRow = {
  /**
   * For the row element: `data-ringing="true"` and the row colors when the
   * row rings.
   */
  rowProps: { "data-ringing"?: "true"; style?: CSSProperties };
  /** For the cell at `index` of the row's `count` cells. */
  cellProps: (index: number, count: number) => RingingCellProps;
  /**
   * The visually hidden, unselectable reason, to render after the content of
   * the row's first cell so it is neither the element column autofit measures
   * nor part of copied text; null when quiet.
   */
  reason: ReactNode;
};

const QUIET_ROW: RingingRow = {
  rowProps: {},
  cellProps: () => ({}),
  reason: null,
};

/**
 * Whether an alert's row rings: the table's preset is noisy and the alert is
 * one that makes the preset's alarm sound, i.e. `matchesNoiseBase` from
 * `entities/presets/model/noise.ts`, which is built from the same values as
 * `NOISE_BASE_CEL` (the alarm's CEL).
 */
export function isAlertRinging(
  alert: RingingAlert | null | undefined,
  presetNoisy?: boolean
): boolean {
  return !!presetNoisy && matchesNoiseBase(alert);
}

/**
 * The ringing wiring for every row of a table whose preset is `presetNoisy`.
 * Returns a function that tells how the row of one alert, or of a group of
 * alerts (it rings when any of them does), renders.
 *
 * A ringing cell keeps its own background (hover, last viewed, selection) and
 * gets an overlay behind its content: a 10% tint of the blink red, with a
 * solid red edge on the left of the first cell and the right of the last. The
 * top and bottom edges belong to the row: `tr[data-ringing]` in `globals.css`
 * draws them once across the whole row, above the cells, so they stay one
 * straight line at fractional zoom, where a pinned cell is drawn on its own
 * layer and per-cell edges stepped at its border. Where two ringing rows
 * touch, the lower one drops its top edge, so one 2px line separates them.
 * The row carries the colors, which its cells inherit. Only the overlays'
 * opacity pulses, in step with the page's other blinks; under reduced motion
 * they hold still. The tint is off, and only the edge
 * pulses, while the cell's `<tr>` is hovered (`tr.group:hover`, the same row
 * hover that sets the cells' orange background) or is selected or being
 * drag-selected (`tr[data-selection]`, set by `SelectableRow`), because over
 * those backgrounds it would take red-500 marks under 3:1 at the strong phase.
 * A cell that is not sticky is made `relative` to hold the overlay.
 */
export function useRingingRows(presetNoisy: boolean) {
  const syncCellPulse = useSyncedAnimation(presetNoisy, "::before");
  const syncEdgePulse = useSyncedAnimation(presetNoisy, "::after");
  const syncPulse = useCallback(
    (cell: HTMLElement | null) => {
      syncCellPulse(cell);
      syncEdgePulse(cell?.parentElement ?? null);
    },
    [syncCellPulse, syncEdgePulse]
  );

  return useCallback(
    (alerts: RingingAlert | RingingAlert[]): RingingRow => {
      const ringing = (Array.isArray(alerts) ? alerts : [alerts]).some(
        (alert) => isAlertRinging(alert, presetNoisy)
      );
      if (!ringing) {
        return QUIET_ROW;
      }
      return {
        rowProps: { "data-ringing": "true", style: RINGING_STYLE },
        cellProps: (index, count) => ({
          className: clsx(
            RINGING_CELL_CLASS_NAME,
            index === 0 && "before:border-l-2",
            index === count - 1 && "before:border-r-2"
          ),
          ref: syncPulse,
        }),
        reason: REASON,
      };
    },
    [presetNoisy, syncPulse]
  );
}
