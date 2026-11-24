import { useEffect, useRef, useState } from "react";
import { IncidentDto, Status } from "./models";
import { parseDeadline } from "../lib/dismissal-deadline";

export { parseDeadline };

// setTimeout fires immediately for anything longer than 2^31-1 ms (~24.8 days).
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
// Refetch a moment after the deadline, not on it: the gateway decides whether
// a dismissal is live by its own clock.
const EXPIRY_GRACE_MS = 1000;
// A deadline already behind us that still reads suppressed means the browser's
// clock runs ahead of the gateway's. Ask again, backing off, a bounded number of
// times: 5s, 10s, 20s, 40s, then 60s.
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 60_000;
export const MAX_RETRIES = 6;

/** The earliest `dismissed_until` among incidents that still read suppressed. */
export function getNextDismissalExpiry(incidents: IncidentDto[]): number | null {
  let nextDeadline: number | null = null;
  for (const incident of incidents) {
    if (
      incident.status !== Status.Suppressed ||
      incident.dismiss_mode !== "dismiss_until" ||
      !incident.dismissed_until
    ) {
      continue;
    }
    const deadline = parseDeadline(incident.dismissed_until);
    if (Number.isNaN(deadline)) {
      continue;
    }
    if (nextDeadline === null || deadline < nextDeadline) {
      nextDeadline = deadline;
    }
  }
  return nextDeadline;
}

/**
 * Milliseconds until the list should be refetched to pick up the earliest
 * time-boxed dismissal lapsing, or null when there is nothing to wait for.
 * `retries` counts refetches already made after that deadline passed.
 *
 * A "dismiss until" incident reads suppressed only while `dismissed_until` is
 * in the future. The gateway derives that on every read and nothing rewrites
 * the row at the deadline, so no SSE event announces it — the client has to
 * know when to ask again.
 */
export function getDismissalExpiryDelay(
  incidents: IncidentDto[],
  now: number,
  retries: number = 0
): number | null {
  const nextDeadline = getNextDismissalExpiry(incidents);
  if (nextDeadline === null) {
    return null;
  }
  if (nextDeadline > now) {
    return Math.min(nextDeadline - now + EXPIRY_GRACE_MS, MAX_TIMEOUT_MS);
  }
  if (retries >= MAX_RETRIES) {
    return null;
  }
  return Math.min(RETRY_BASE_MS * 2 ** retries, RETRY_MAX_MS);
}

/**
 * Calls `revalidate` when the earliest time-boxed dismissal among `incidents`
 * lapses, so the incident flips back from suppressed without a page refresh.
 */
export function useRevalidateOnDismissalExpiry(
  incidents: IncidentDto[] | undefined,
  revalidate: () => void,
  paused: boolean = false
) {
  // Bumped on every firing so the timer re-arms even when the refetch comes
  // back with data identical to what we already had.
  const [tick, setTick] = useState(0);
  // Refetches made after the current earliest deadline passed; starts over
  // whenever that deadline changes.
  const retries = useRef<{ deadline: number | null; count: number }>({
    deadline: null,
    count: 0,
  });

  useEffect(() => {
    if (paused || !incidents) {
      return;
    }
    const now = Date.now();
    const nextDeadline = getNextDismissalExpiry(incidents);
    if (nextDeadline !== retries.current.deadline) {
      retries.current = { deadline: nextDeadline, count: 0 };
    }
    const lapsed = nextDeadline !== null && nextDeadline <= now;
    const delay = getDismissalExpiryDelay(
      incidents,
      now,
      retries.current.count
    );
    if (delay === null) {
      return;
    }
    const timeout = setTimeout(() => {
      if (lapsed) {
        retries.current.count += 1;
      }
      revalidate();
      setTick((value) => value + 1);
    }, delay);
    return () => clearTimeout(timeout);
  }, [incidents, revalidate, paused, tick]);
}
