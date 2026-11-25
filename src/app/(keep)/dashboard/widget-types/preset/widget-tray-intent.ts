import { RefObject, useEffect } from "react";
import {
  QUICK_ACTIVE_ATTR,
  QUICK_LEAVING_ATTR,
  QUICK_TRAY_CLASS,
} from "@/features/alerts/alert-quick-actions";
import { placeTray } from "./widget-tray-placement";

/** How long, in milliseconds, the pointer must rest on a row before its tray shows. */
export const TRAY_INTENT_MS = 100;

/** How long, in milliseconds, the tray stays after the pointer leaves the table, before it fades. */
export const TRAY_LEAVE_MS = 150;

/** How long, in milliseconds, a leaving row's tray and tint take to fade. */
export const TRAY_FADE_MS = 100;

/**
 * Shows at most one row tray in the table inside `containerRef`, by marking
 * one row `QUICK_ACTIVE_ATTR`:
 * - The pointer resting `TRAY_INTENT_MS` on a row with a tray makes it the
 *   active row, placed (`placeTray`) in the same step. The previous active
 *   row stops being active in that same step, so two trays never show. A
 *   sweep that moves on sooner shows none.
 * - The pointer back on the active row, its tray included, cancels a pending
 *   switch, so a diagonal move to the tray across the next row keeps it.
 * - The pointer leaving the table deactivates the row after `TRAY_LEAVE_MS`,
 *   marked `QUICK_LEAVING_ATTR` for the `TRAY_FADE_MS` its tray takes to fade.
 *   The pointer back on that row meanwhile makes it active again at once.
 * - Keyboard focus in a row (`:focus-visible`) makes it active at once, and
 *   focus leaving the table deactivates it.
 * Nothing is attached while `enabled` is false. Timers, listeners and marks
 * are cleared when it turns false or the table unmounts.
 */
export function useTrayHoverIntent(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) {
      return;
    }
    let active: HTMLTableRowElement | null = null;
    let leaving: HTMLTableRowElement | null = null;
    let pendingRow: HTMLTableRowElement | null = null;
    let pendingTimer: number | undefined;
    let leaveTimer: number | undefined;
    let fadeTimer: number | undefined;

    const trayOf = (row: HTMLTableRowElement) =>
      row.querySelector<HTMLElement>(`.${QUICK_TRAY_CLASS}`);
    const rowOf = (target: EventTarget | null) => {
      const row =
        target instanceof Element ? target.closest<HTMLTableRowElement>("tr") : null;
      return row && container.contains(row) && trayOf(row) ? row : null;
    };
    const cancelPending = () => {
      window.clearTimeout(pendingTimer);
      pendingTimer = undefined;
      pendingRow = null;
    };
    const cancelLeave = () => {
      window.clearTimeout(leaveTimer);
      leaveTimer = undefined;
    };
    const clearLeaving = () => {
      window.clearTimeout(fadeTimer);
      fadeTimer = undefined;
      leaving?.removeAttribute(QUICK_LEAVING_ATTR);
      leaving = null;
    };
    const activate = (row: HTMLTableRowElement) => {
      cancelPending();
      cancelLeave();
      clearLeaving();
      if (row === active) {
        return;
      }
      const tray = trayOf(row);
      if (!tray) {
        return;
      }
      active?.removeAttribute(QUICK_ACTIVE_ATTR);
      placeTray(row, tray);
      row.setAttribute(QUICK_ACTIVE_ATTR, "");
      active = row;
    };
    const deactivate = (fade: boolean) => {
      cancelPending();
      cancelLeave();
      clearLeaving();
      if (!active) {
        return;
      }
      active.removeAttribute(QUICK_ACTIVE_ATTR);
      if (fade) {
        active.setAttribute(QUICK_LEAVING_ATTR, "");
        leaving = active;
        fadeTimer = window.setTimeout(clearLeaving, TRAY_FADE_MS);
      }
      active = null;
    };

    const onPointerOver = (event: PointerEvent) => {
      cancelLeave();
      const row = rowOf(event.target);
      if (row !== null && row === leaving) {
        activate(row);
        return;
      }
      if (row === active || row === null) {
        cancelPending();
        return;
      }
      if (row === pendingRow) {
        return;
      }
      cancelPending();
      pendingRow = row;
      pendingTimer = window.setTimeout(() => activate(row), TRAY_INTENT_MS);
    };
    const onPointerLeave = () => {
      cancelPending();
      if (active && leaveTimer === undefined) {
        leaveTimer = window.setTimeout(() => deactivate(true), TRAY_LEAVE_MS);
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const row = rowOf(event.target);
      if (row && (event.target as Element).matches(":focus-visible")) {
        activate(row);
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node) || !container.contains(next)) {
        deactivate(false);
      }
    };

    container.addEventListener("pointerover", onPointerOver);
    container.addEventListener("pointerleave", onPointerLeave);
    container.addEventListener("focusin", onFocusIn);
    container.addEventListener("focusout", onFocusOut);
    return () => {
      container.removeEventListener("pointerover", onPointerOver);
      container.removeEventListener("pointerleave", onPointerLeave);
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", onFocusOut);
      deactivate(false);
    };
  }, [containerRef, enabled]);
}
