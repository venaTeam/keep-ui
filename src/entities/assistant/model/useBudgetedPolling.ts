import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const POLL_INTERVAL_MS = 3_000;

const NONE: ReadonlySet<string> = new Set();

/**
 * Calls `poll` every 3 s, counted from the end of the previous call, while
 * anything is waited for and within its budget. `poll` answers whether polling
 * still makes sense.
 *
 * @param budgets - The milliseconds each awaited thing may take. A key that
 *   leaves and comes back starts over.
 */
export function useBudgetedPolling(
  budgets: Record<string, number>,
  poll: () => Promise<boolean>
): {
  /** The keys that used up their budget. */
  timedOut: ReadonlySet<string>;
  /** Gives a key its whole budget again. */
  restart: (key: string) => void;
} {
  const [timedOutKeys, setTimedOutKeys] = useState(NONE);
  const waitingSince = useRef(new Map<string, number>());
  const budgetsRef = useRef(budgets);
  const pollRef = useRef(poll);
  budgetsRef.current = budgets;
  pollRef.current = poll;

  const awaitedKeys = Object.keys(budgets).sort().join("\n");
  const timedOut = useMemo(
    () =>
      new Set(
        awaitedKeys.split("\n").filter((key) => timedOutKeys.has(key))
      ) as ReadonlySet<string>,
    [awaitedKeys, timedOutKeys]
  );
  const isActive = awaitedKeys
    .split("\n")
    .some((key) => key !== "" && !timedOut.has(key));

  useEffect(
    function trackAwaitedKeys() {
      const awaited = new Set(awaitedKeys.split("\n").filter(Boolean));
      const since = waitingSince.current;
      Array.from(since.keys()).forEach((key) => {
        if (!awaited.has(key)) {
          since.delete(key);
        }
      });
      awaited.forEach((key) => {
        if (!since.has(key)) {
          since.set(key, Date.now());
        }
      });
      setTimedOutKeys((keys) =>
        Array.from(keys).every((key) => awaited.has(key))
          ? keys
          : new Set(Array.from(keys).filter((key) => awaited.has(key)))
      );
    },
    [awaitedKeys]
  );

  useEffect(
    function pollWhileActive() {
      if (!isActive) {
        return;
      }
      let isStopped = false;
      let timer: ReturnType<typeof setTimeout>;

      const getSpentKeys = () =>
        Object.entries(budgetsRef.current).flatMap(([key, budget]) => {
          const since = waitingSince.current.get(key);
          return since !== undefined && Date.now() - since >= budget
            ? [key]
            : [];
        });

      const tick = async () => {
        const isWorthwhile = await pollRef.current();
        if (isStopped) {
          return;
        }
        const spent = isWorthwhile
          ? getSpentKeys()
          : Object.keys(budgetsRef.current);
        if (spent.length > 0) {
          setTimedOutKeys((keys) => new Set([...Array.from(keys), ...spent]));
        }
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      };
      timer = setTimeout(tick, POLL_INTERVAL_MS);

      return () => {
        isStopped = true;
        clearTimeout(timer);
      };
    },
    [isActive]
  );

  const restart = useCallback((key: string) => {
    waitingSince.current.set(key, Date.now());
    setTimedOutKeys(
      (keys) => new Set(Array.from(keys).filter((other) => other !== key))
    );
  }, []);

  return { timedOut, restart };
}
