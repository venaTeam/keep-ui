import { RefObject, useEffect } from "react";
import {
  QUICK_ACTIVE_ATTR,
  QUICK_LEAVING_ATTR,
  QUICK_OPEN_ATTR,
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
 * - The pointer leaving the table, or moving onto anything in it that is
 *   neither a row with a tray nor the active row (the header, a group row),
 *   deactivates the row after `TRAY_LEAVE_MS`,
 *   marked `QUICK_LEAVING_ATTR` for the `TRAY_FADE_MS` its tray takes to fade.
 *   The pointer back on that row meanwhile makes it active again at once.
 * - Touch and pen don't hover: their pointerover and pointerleave are
 *   ignored. A tap (pointerdown) on a row with a tray makes it active at
 *   once, without blocking the row's own click, and it stays active after the
 *   finger lifts. A tap anywhere else on the page, the active row and its
 *   tray aside, deactivates it.
 * - Keyboard focus in a row (`:focus-visible`), or any focus on a tray
 *   button, makes the row active at once. Focus leaving the table, or moving
 *   to anything in it outside the rows with a tray, deactivates it.
 * - The active row whose dialog is open (it holds `QUICK_OPEN_ATTR`) is not
 *   deactivated: a deactivation asked for meanwhile waits until the dialog
 *   closes, and is dropped if focus came back into the row or the row is
 *   hovered.
 * - While a row is active, its tray is placed again when anything holding the
 *   row scrolls (the rows area, the table's wrapper, the page) and when the
 *   window resizes.
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
    let deferredFade: boolean | null = null;
    let openObserver: MutationObserver | null = null;

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
      stopWaitingForClose();
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
    const isOpen = (row: HTMLTableRowElement) =>
      row.querySelector(`[${QUICK_OPEN_ATTR}]`) !== null;
    const stopWaitingForClose = () => {
      openObserver?.disconnect();
      openObserver = null;
      deferredFade = null;
    };
    const onOpenRowChange = () => {
      if (deferredFade === null || (active && isOpen(active))) {
        return;
      }
      const fade = deferredFade;
      stopWaitingForClose();
      const keep =
        active &&
        (active.contains(document.activeElement) || active.matches(":hover"));
      if (!keep) {
        deactivate(fade);
      }
    };
    const deactivate = (fade: boolean) => {
      cancelPending();
      cancelLeave();
      if (active && isOpen(active)) {
        deferredFade = deferredFade === null ? fade : deferredFade && fade;
        openObserver ??= new MutationObserver(onOpenRowChange);
        openObserver.observe(active, { childList: true, subtree: true });
        return;
      }
      stopWaitingForClose();
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

    const startLeave = () => {
      if (active && leaveTimer === undefined) {
        leaveTimer = window.setTimeout(() => deactivate(true), TRAY_LEAVE_MS);
      }
    };
    const isTouchLike = (event: PointerEvent) =>
      event.pointerType === "touch" || event.pointerType === "pen";
    const onPointerOver = (event: PointerEvent) => {
      if (isTouchLike(event)) {
        return;
      }
      const row = rowOf(event.target);
      if (row === null) {
        cancelPending();
        const target = event.target as Node;
        if (!active?.contains(target)) {
          startLeave();
        }
        return;
      }
      cancelLeave();
      if (row === leaving) {
        activate(row);
        return;
      }
      if (row === active) {
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
    const onPointerLeave = (event: PointerEvent) => {
      if (isTouchLike(event)) {
        return;
      }
      cancelPending();
      startLeave();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!isTouchLike(event)) {
        return;
      }
      const row = rowOf(event.target);
      if (row) {
        activate(row);
      } else if (!(event.target instanceof Node && active?.contains(event.target))) {
        deactivate(true);
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const row = rowOf(event.target);
      const target = event.target as Element;
      const onTray = row !== null && trayOf(row)?.contains(target) === true;
      if (row && (onTray || target.matches(":focus-visible"))) {
        activate(row);
      } else if (row === null) {
        deactivate(false);
      }
    };
    const placeActiveAgain = () => {
      const tray = active && trayOf(active);
      if (active && tray) {
        placeTray(active, tray);
      }
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && active && event.target.contains(active)) {
        placeActiveAgain();
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
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", placeActiveAgain);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", placeActiveAgain);
      container.removeEventListener("pointerover", onPointerOver);
      container.removeEventListener("pointerleave", onPointerLeave);
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", onFocusOut);
      stopWaitingForClose();
      clearLeaving();
      active?.removeAttribute(QUICK_ACTIVE_ATTR);
      active = null;
      cancelPending();
      cancelLeave();
    };
  }, [containerRef, enabled]);
}
