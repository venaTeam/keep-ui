/**
 * Server-Sent Events (SSE) hook for real-time notifications.
 *
 * This is a thin React wrapper over `sseConnectionManager`, which owns a single
 * SSE connection shared across all browser tabs (leader election via Web Locks
 * + BroadcastChannel fan-out, with a per-tab fallback). The public API
 * (`{ bind, unbind }`) is unchanged, so consumers need no modification.
 */

import { useCallback, useEffect } from "react";
import { useConfig } from "./useConfig";
import { useHydratedSession as useSession } from "@/shared/lib/hooks/useHydratedSession";
import {
  ensureSSEConnected,
  bindSSEHandler,
  unbindSSEHandler,
} from "./sseConnectionManager";

export const useSSE = () => {
  const { data: configData } = useConfig();
  const { data: user_session, status } = useSession();

  // Ensure the shared SSE connection is established (idempotent across all
  // hook instances and tabs).
  useEffect(() => {
    // Check if SSE is disabled
    if (configData?.SSE_DISABLED === true) {
      return;
    }

    // Don't connect if we don't have config yet
    if (configData === null || configData === undefined) {
      return;
    }

    // Wait for authentication if auth is required (status is loading initially)
    if (status === "loading") {
      return;
    }

    const session =
      status === "unauthenticated"
        ? { accessToken: "unauthenticated" }
        : user_session;

    const apiUrl = configData.API_URL;
    if (!apiUrl) {
      console.error(
        "useSSE: API_URL not configured, cannot establish SSE connection"
      );
      return;
    }

    ensureSSEConnected({ token: session?.accessToken, apiUrl });
    // Intentionally key off the access token only (not the whole session
    // object) so we don't tear down/reconnect on every session identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configData, user_session?.accessToken, status]);

  const bind = useCallback((event: string, callback: (data: any) => void) => {
    bindSSEHandler(event, callback);
  }, []);

  const unbind = useCallback((event: string, callback: (data: any) => void) => {
    unbindSSEHandler(event, callback);
  }, []);

  return {
    bind,
    unbind,
  };
};
