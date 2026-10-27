import type { FullConfig } from "@playwright/test";
import { env } from "./fixtures/test-base";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForHealthy(url: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
      if (res.status >= 200 && res.status < 500) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `[global-setup] ${url} never became healthy within ${timeoutMs}ms. ` +
          `Deploy the stack first (sanity-check Step 1: ./deploy.sh --root <keep-repos>).`
      );
    }
    await sleep(2_000);
  }
}

/**
 * Asserts AUTH_TYPE=noauth. The gateway always wants *a* credential (a tokenless
 * call returns 401 "Missing API Key" even in noauth), so we probe with a BOGUS
 * x-api-key: in noauth the verifier accepts any key and falls back to the `keep`
 * tenant (→ 2xx); in any real auth mode an unknown key is rejected (→ 401/403).
 * Fail fast so the suite is never run against an auth-enabled stack.
 */
async function assertNoAuth(gateway: string, apiKey: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${gateway}/preset`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(5_000),
    });
  } catch (e) {
    throw new Error(`[global-setup] could not probe ${gateway}/preset for auth mode: ${e}`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `[global-setup] gateway rejected a bogus x-api-key (HTTP ${res.status} on GET /preset). ` +
        `This suite requires AUTH_TYPE=noauth — redeploy the stack in noauth mode.`
    );
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  await waitForHealthy(`${env.gateway}/healthcheck`);
  await waitForHealthy(`${env.workflows}/healthcheck`);
  await waitForHealthy(env.uiBaseUrl);
  await assertNoAuth(env.gateway, env.apiKey);
  // eslint-disable-next-line no-console
  console.log(`[global-setup] stack healthy + noauth confirmed (gateway ${env.gateway})`);
}
