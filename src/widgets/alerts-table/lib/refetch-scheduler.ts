export const ALERT_REFETCH_DEBOUNCE_MS = 800;
export const ALERT_REFETCH_MAX_WAIT_MS = 2000;

export interface RefetchTimers {
  debounce: NodeJS.Timeout | null;
  maxWait: NodeJS.Timeout | null;
  refetch?: () => void;
}

/**
 * Schedule a debounced refetch, bounded by a max-wait deadline.
 *
 * The trailing-edge debounce alone never fires while events keep arriving
 * faster than the debounce interval, so under a sustained alert storm the
 * feed froze until the stream went quiet. The max-wait timer is armed on the
 * first pending event and forces the refetch even if the debounce keeps
 * resetting, capping staleness at ALERT_REFETCH_MAX_WAIT_MS.
 *
 * Whichever timer fires calls the refetch from the most recent call, held on
 * `timers` — the max-wait timer outlives many events, and the callback's
 * identity can change between them (SWR's mutate is bound to the current
 * query key), so a flush must never revalidate a stale key.
 *
 * Timer state lives in the caller-owned `timers` object so React callers can
 * keep it in a ref across renders; cancel via clearRefetchTimers on unmount.
 */
export function scheduleRefetchWithMaxWait(
  timers: RefetchTimers,
  refetch: () => void,
  debounceMs: number = ALERT_REFETCH_DEBOUNCE_MS,
  maxWaitMs: number = ALERT_REFETCH_MAX_WAIT_MS
): void {
  timers.refetch = refetch;

  const flush = () => {
    clearRefetchTimers(timers);
    timers.refetch?.();
  };

  if (timers.debounce) {
    clearTimeout(timers.debounce);
  }
  timers.debounce = setTimeout(flush, debounceMs);
  if (!timers.maxWait) {
    timers.maxWait = setTimeout(flush, maxWaitMs);
  }
}

/**
 * Cancel any pending flush, e.g. when the consuming component unmounts.
 */
export function clearRefetchTimers(timers: RefetchTimers): void {
  if (timers.debounce) {
    clearTimeout(timers.debounce);
  }
  if (timers.maxWait) {
    clearTimeout(timers.maxWait);
  }
  timers.debounce = null;
  timers.maxWait = null;
}
