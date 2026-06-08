import { defineConfig, devices } from "@playwright/test";

/**
 * Sanity-check E2E suite — runs against the LIVE deployed Keep stack the
 * sanity-check skill brings up (UI :3000, gateway :8080, workflows :8081).
 *
 * Requirements:
 *  - The stack must be deployed with AUTH_TYPE=noauth (asserted in global-setup).
 *  - The pipeline is eventually consistent (Gateway → Kafka → event-handler →
 *    Postgres → UI), so assertions POLL: web-first `expect` timeout is 30s and
 *    the REST helper has its own poll loops. Specs run serially on one worker so
 *    the shared Postgres stays deterministic.
 *
 * Output the agent reads: e2e/results/checks.json (flat, keyed by [check:NN]).
 */
const UI_BASE_URL = process.env.UI_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e/specs",
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "./e2e/results/artifacts",
  fullyParallel: false, // shared DB + async pipeline → keep ordering deterministic
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 1, // one retry absorbs pipeline-lag flakes
  timeout: 90_000, // generous per-test (pipeline is eventually consistent)
  expect: { timeout: 30_000 }, // web-first assertions poll up to ~30s
  reporter: [
    ["list"],
    ["json", { outputFile: "e2e/results/results.json" }],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["./e2e/fixtures/check-reporter.ts", { outputFile: "e2e/results/checks.json" }],
  ],
  use: {
    baseURL: UI_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
