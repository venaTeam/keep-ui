"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  NavigationBlocker,
  useNavigationGuardStore,
} from "@/shared/lib/navigation-guard";

// Marks the extra history entry pushed so browser Back can be intercepted.
const SENTINEL = "__keepLeaveGuard";

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
    const { setBlocker } = useNavigationGuardStore.getState();

    const block: NavigationBlocker = (proceed) => {
      if (!active) {
        proceed();
        return;
      }
      onBlockedRef.current(() => {
        // Disarm first so the navigation that follows is not held back again.
        active = false;
        leaving = true;
        setBlocker(null);
        proceed();
      });
    };
    setBlocker(block);

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
      e.preventDefault();
      e.stopPropagation();
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
      pushSentinel();
      block(() => window.history.go(-2));
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
      if (useNavigationGuardStore.getState().blocker === block) {
        setBlocker(null);
      }
      // Changes were saved or discarded in place: drop the extra entry.
      if (!leaving && isSentinelCurrent()) {
        window.history.back();
      }
    };
    // Only `enabled` may re-run this: a re-run drops the extra history entry.
  }, [enabled]);
}
