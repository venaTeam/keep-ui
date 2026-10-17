import { defineConfig, devices } from "@playwright/test";
const featureOff = process.env.AUTOMATIONS_TEST_FLAG_OFF === "true";
const readOnly = process.env.AUTOMATIONS_TEST_READ_ONLY === "true";
const mode = featureOff ? "flag-off" : readOnly ? "read-only" : "enabled";
export default defineConfig({
  testDir: "./e2e/automations",
  testMatch: "automations.spec.ts",
  workers: 1,
  outputDir: `test-results/automations-${mode}`,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: `e2e/results/automations-${mode}.json` }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3199",
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node e2e/automations/fixtures/server.cjs",
      url: "http://127.0.0.1:4199/health",
      reuseExistingServer: false,
    },
    {
      command: process.env.CI
        ? "npm run start -- -p 3199"
        : "node node_modules/next/dist/bin/next dev --turbopack -p 3199",
      url: "http://localhost:3199/signin",
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        AUTH_TYPE: "noauth",
        AUTH_SECRET: "g27-test-session-secret-do-not-use-in-production",
        AUTH_DEBUG: "false",
        NEXTAUTH_URL: "http://localhost:3199",
        AUTH_URL: "http://localhost:3199",
        API_URL: "http://127.0.0.1:4199",
        API_URL_CLIENT: "http://127.0.0.1:4199",
        AUTOMATIONS_API_URL: "http://127.0.0.1:4199",
        KEEP_AUTOMATIONS_ENABLED: featureOff ? "false" : "true",
        KEEP_READ_ONLY: readOnly ? "true" : "false",
        SSE_DISABLED: "true",
        SENTRY_DISABLED: "true",
        KEEP_AI_FEATURES_DISABLED: "true",
      },
    },
  ],
});
