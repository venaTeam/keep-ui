import { test as setup, expect } from "@playwright/test";
import * as path from "node:path";

export const STORAGE_STATE = path.join(__dirname, ".auth/user.json");

/**
 * Establish a noauth session once, then save it for every spec.
 *
 * Under AUTH_TYPE=noauth the app still requires a NextAuth session: any page
 * redirects to `/signin`, where `SignInForm` auto-calls `signIn("credentials")`
 * (the "NoAuth" provider) and redirects to the callbackUrl with a session cookie.
 * The client-side `/backend/*` proxy uses that session's accessToken, so without
 * it the alerts feed gets 401/500 and renders empty. We drive the auto-signin to
 * completion here and persist the cookie via storageState.
 */
setup("authenticate (noauth)", async ({ page }) => {
  await page.goto(`/signin?callbackUrl=${encodeURIComponent("/alerts/feed")}`);

  // The NoAuth provider signs in automatically; wait until we've left /signin.
  await page.waitForURL((url) => !url.pathname.startsWith("/signin"), {
    timeout: 60_000,
  });

  // Confirm the session is real before trusting the cookie.
  await expect
    .poll(
      async () => {
        const res = await page.request.get("/api/auth/session");
        const json = await res.json().catch(() => ({}));
        return json?.user?.email ?? null;
      },
      { timeout: 30_000, intervals: [1_000] }
    )
    .not.toBeNull();

  await page.context().storageState({ path: STORAGE_STATE });
});
