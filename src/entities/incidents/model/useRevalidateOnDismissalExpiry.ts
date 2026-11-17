import { useEffect, useState } from "react";
import { IncidentDto, Status } from "./models";

// setTimeout fires immediately for anything longer than 2^31-1 ms (~24.8 days).
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
// Refetch a moment after the deadline, not on it: the gateway decides whether
// a dismissal is live by its own clock.
const EXPIRY_GRACE_MS = 1000;
// A deadline already behind us that still reads suppressed means the browser's
// clock runs ahead of the gateway's. Keep asking until the gateway agrees.
const RETRY_MS = 5000;

/**
 * Milliseconds until the list should be refetched to pick up the earliest
 * time-boxed dismissal lapsing, or null when nothing on screen will lapse.
 *
 * A "dismiss until" incident reads suppressed only while `dismissed_until` is
 * in the future. The gateway derives that on every read and nothing rewrites
 * the row at the deadline, so no SSE event announces it — the client has to
 * know when to ask again.
 */
export function getDismissalExpiryDelay(
  incidents: IncidentDto[],
  now: number
): number | null {
  let nextDeadline: number | null = null;
  for (const incident of incidents) {
    if (
      incident.status !== Status.Suppressed ||
      incident.dismiss_mode !== "dismiss_until" ||
      !incident.dismissed_until
    ) {
      continue;
    }
    const deadline = Date.parse(incident.dismissed_until);
    if (Number.isNaN(deadline)) {
      continue;
    }
    if (nextDeadline === null || deadline < nextDeadline) {
      nextDeadline = deadline;
    }
  }

  if (nextDeadline === null) {
    return null;
  }
  if (nextDeadline <= now) {
    return RETRY_MS;
  }
  return Math.min(nextDeadline - now + EXPIRY_GRACE_MS, MAX_TIMEOUT_MS);
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

  useEffect(() => {
    if (paused || !incidents) {
      return;
    }
    const delay = getDismissalExpiryDelay(incidents, Date.now());
    if (delay === null) {
      return;
    }
    const timeout = setTimeout(() => {
      revalidate();
      setTick((value) => value + 1);
    }, delay);
    return () => clearTimeout(timeout);
  }, [incidents, revalidate, paused, tick]);
}
