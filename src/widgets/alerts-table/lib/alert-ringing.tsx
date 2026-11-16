import React, { type CSSProperties } from "react";
import { Severity, Status } from "@/entities/alerts/model/types";
import {
  DEFAULT_BLINK_COLOR,
  getRowBlinkStyle,
} from "@/shared/lib/blink-palette";

/** What assistive tech is told about a ringing row, which colour and motion alone don't convey. */
export const RINGING_REASON = "Ringing: critical, firing, noisy preset";

/**
 * The Count feature's red pulse (`missing-blink`) on a ringing row, or a steady
 * light red tint for viewers who prefer reduced motion.
 */
export const RINGING_CLASS_NAME =
  "motion-safe:animate-missing-blink motion-reduce:bg-[color:var(--blink-soft)] motion-reduce:text-[color:var(--blink-soft-text)]";

/**
 * For the cells of a ringing `<tr>`: their own opaque background would hide
 * the row's pulse, so they take the row's (animated) background instead.
 */
export const RINGING_CELL_CLASS_NAME = "!bg-inherit";

const RINGING_STYLE = getRowBlinkStyle(DEFAULT_BLINK_COLOR);

type RingingProps = {
  className?: string;
  style?: CSSProperties;
  "data-ringing"?: "true";
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
  alert:
    | { severity?: unknown; status?: unknown; deleted?: unknown }
    | null
    | undefined,
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
 * Props that make a row ring: the pulse classes, the blink palette's row
 * colors and `data-ringing="true"`. On a CSS-grid table, give them to every
 * cell of the row. Empty for a quiet row, which then renders as before.
 */
export function getRingingProps(ringing: boolean): RingingProps {
  return ringing
    ? {
        className: RINGING_CLASS_NAME,
        style: RINGING_STYLE,
        "data-ringing": "true",
      }
    : {};
}

/** Visually hidden text that gives a ringing row's reason to assistive tech. */
export function RingingReason() {
  return <span className="sr-only">{RINGING_REASON}</span>;
}
