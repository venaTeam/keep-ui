"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  NavigationBlocker,
  useNavigationGuardStore,
} from "@/shared/lib/navigation-guard";

// Marks the extra history entry pushed so browser Back can be intercepted.
//
// Next's App Router cannot cancel a Back navigation: by the time popstate
// fires the previous page is already rendering. So while the guard is on we
// push a copy of the current URL; Back then lands on the real entry (same URL,
// page stays mounted), we push the copy again and ask. Continue goes back two
// entries to the page the user meant.
//
// Known trade-off: pushState always drops the browser's Forward entries, so
// pages the user could reach with Forward before editing are no longer
// reachable that way (and Forward lands on the leftover copy after Save or
// Cancel). Accepted: nothing is lost but the Forward shortcut, and without the
// copy Back would silently discard unsaved changes.
//
// The page may push its own entries on top of the copy (e.g. a filter writing
// `?range=` to the URL). Back onto the copy then only steps through the page's
// own URLs and is let through; Save or Cancel from there leaves the copy in
// place, which costs one extra Back press on the same page.
const SENTINEL = "__keepLeaveGuard";

// Where Continue goes when Back has no earlier page (opened in a new tab).
const FALLBACK_ROUTE = "/";

// True while our own history.back() (dropping the copy) is in flight. If the
// guard turns on again before it lands, its popstate must not look like the
// user pressing Back.
let droppingSentinel = false;

const isSentinelCurrent = () => Boolean(window.history.state?.[SENTINEL]);

const pushSentinel = () =>
  window.history.pushState(
    { ...window.history.state, [SENTINEL]: true },
    "",
    window.location.href
  );

const opensElsewhere = (e: MouseEvent, anchor: HTMLAnchorElement) =>
  e.button !== 0 ||
  e.metaKey ||
  e.ctrlKey ||
  e.shiftKey ||
  e.altKey ||
  anchor.hasAttribute("download") ||
  (Boolean(anchor.target) && anchor.target !== "_self");

/**
 * While `enabled`, holds back every way of leaving the page and hands it to
 * `onBlocked`, which decides whether to run `proceed`:
 * - same-tab link clicks (captured before Next's <Link> handles them)
 * - navigation done in code through `confirmNavigation`
 * - browser Back / Forward (via an extra history entry)
 * - reload, closing the tab, typing a URL (the browser's own dialog)
 */
export function useLeaveGuard(enabled: boolean, onBlocked: NavigationBlocker) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const onBlockedRef = useRef(onBlocked);
  onBlockedRef.current = onBlocked;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    let leaving = false;
    let removeBlocker = () => {};
    const pagePath = window.location.pathname;

    const block: NavigationBlocker = (proceed) => {
      if (!active) {
        proceed();
        return;
      }
      onBlockedRef.current(() => {
        // Disarm first so the navigation that follows is not held back again.
        active = false;
        leaving = true;
        removeBlocker();
        proceed();
      });
    };
    removeBlocker = useNavigationGuardStore.getState().addBlocker(block);

    const onClick = (e: MouseEvent) => {
      if (!active || e.defaultPrevented) {
        return;
      }
      const anchor = (e.target as Element | null)?.closest?.(
        "a[href]"
      ) as HTMLAnchorElement | null;
      if (!anchor || opensElsewhere(e, anchor)) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      const here = window.location;
      if (
        url.origin === here.origin &&
        url.pathname === here.pathname &&
        url.search === here.search
      ) {
        return;
      }
      // preventDefault alone stops Next's <Link>; the link's own onClick
      // (e.g. closing the mobile sidebar) still runs.
      e.preventDefault();
      block(() => {
        if (url.origin !== here.origin) {
          window.location.assign(url.href);
          return;
        }
        const href = url.pathname + url.search + url.hash;
        // Take over the extra history entry so Back still works normally.
        if (isSentinelCurrent()) {
          routerRef.current.replace(href);
        } else {
          routerRef.current.push(href);
        }
      });
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!active) {
        return;
      }
      e.preventDefault();
      e.returnValue = "";
    };

    // Back from the extra entry lands on the same URL, so nothing visible
    // happens; put the entry back and ask before really going back.
    const onPopState = () => {
      if (!active) {
        return;
      }
      if (droppingSentinel) {
        // Our own cleanup landed, not the user: just put the copy back.
        droppingSentinel = false;
        pushSentinel();
        return;
      }
      if (isSentinelCurrent() && window.location.pathname === pagePath) {
        // Stepped back through the page's own URLs onto the copy.
        return;
      }
      pushSentinel();
      // Right after pushState there are no Forward entries, so the length is
      // the position: 2 means the copy and the real entry are all there is.
      const hasEarlierPage = window.history.length > 2;
      block(() => {
        if (hasEarlierPage) {
          window.history.go(-2);
        } else {
          routerRef.current.replace(FALLBACK_ROUTE);
        }
      });
    };

    if (!isSentinelCurrent()) {
      pushSentinel();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);

    return () => {
      active = false;
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      removeBlocker();
      // Changes were saved or discarded in place: drop the extra entry.
      if (!leaving && isSentinelCurrent()) {
        droppingSentinel = true;
        window.addEventListener(
          "popstate",
          // A guard that turned on again handles it in its own listener first;
          // otherwise nobody does, so clear it once this event is done.
          () => setTimeout(() => (droppingSentinel = false)),
          { once: true }
        );
        window.history.back();
      }
    };
    // Only `enabled` may re-run this: a re-run drops the extra history entry.
  }, [enabled]);
}
