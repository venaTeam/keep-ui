"use client";

import { ComponentProps, useEffect } from "react";
import {
  HosstedButton,
  countSources,
  setHosstedResponse,
} from "@hossted/keep-integration";

// Fingerprints already looked up in this browser tab, so each alert is asked
// for at most once. setHosstedResponse does nothing if the widget already has
// a result for the fingerprint.
const lookedUp = new Set<string>();

// Longest wait for the stored answer. After that the alert keeps showing no
// analysis, as if nothing had been stored.
const RESTORE_TIMEOUT_MS = 5000;

// Asks the Hossted proxy for the answer stored for this alert and gives it to
// the widget, which replaces the no-analysis state with it. Does nothing if no
// answer is stored, the request fails, or it takes longer than the timeout.
export async function restoreHosstedResponse(fingerprint: string) {
  if (lookedUp.has(fingerprint)) return;
  lookedUp.add(fingerprint);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESTORE_TIMEOUT_MS);
  try {
    const res = await fetch(
      `/api/hossted?id=${encodeURIComponent(fingerprint)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return;
    const saved = await res.json();
    if (!saved?.summary || !saved?.response) return;
    setHosstedResponse({
      id: fingerprint,
      status: "success",
      summary: saved.summary,
      response: saved.response,
      thread_id: saved.thread_id,
      sources: saved.sources ?? countSources(saved._metadata?.sources),
    });
  } catch {
    lookedUp.delete(fingerprint);
  } finally {
    clearTimeout(timer);
  }
}

export function useRestoreHosstedResponse(fingerprint?: string) {
  useEffect(() => {
    if (fingerprint) void restoreHosstedResponse(fingerprint);
  }, [fingerprint]);
}

// HosstedButton that first restores the alert's stored answer.
export function RestoredHosstedButton(
  props: ComponentProps<typeof HosstedButton>
) {
  useRestoreHosstedResponse(props.request.fingerprint);
  return <HosstedButton {...props} />;
}
