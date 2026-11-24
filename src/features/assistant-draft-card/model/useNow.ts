import { useEffect, useState } from "react";

// A timer may fire a little early
const MARGIN_MS = 50;

/** The current time, updated when the deadline passes. */
export function useNow(deadline: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const remaining = deadline ? Date.parse(deadline) - Date.now() : 0;
    // False for a date that cannot be parsed too
    if (!(remaining > 0)) {
      return;
    }
    const timer = setTimeout(() => setNow(Date.now()), remaining + MARGIN_MS);
    return () => clearTimeout(timer);
  }, [deadline]);

  return now;
}
