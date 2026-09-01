export const ALERT_REFETCH_DEBOUNCE_MS = 800;
export const ALERT_REFETCH_MAX_WAIT_MS = 2000;

export interface RefetchTimers {
  debounce: NodeJS.Timeout | null;
  maxWait: NodeJS.Timeout | null;
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
 * Timer state lives in the caller-owned `timers` object so React callers can
 * keep it in a ref across renders.
 */
export function scheduleRefetchWithMaxWait(
  timers: RefetchTimers,
  refetch: () => void,
  debounceMs: number = ALERT_REFETCH_DEBOUNCE_MS,
  maxWaitMs: number = ALERT_REFETCH_MAX_WAIT_MS
): void {
  const flush = () => {
    if (timers.debounce) {
      clearTimeout(timers.debounce);
    }
    if (timers.maxWait) {
      clearTimeout(timers.maxWait);
    }
    timers.debounce = null;
    timers.maxWait = null;
    refetch();
  };

  if (timers.debounce) {
    clearTimeout(timers.debounce);
  }
  timers.debounce = setTimeout(flush, debounceMs);
  if (!timers.maxWait) {
    timers.maxWait = setTimeout(flush, maxWaitMs);
  }
}
