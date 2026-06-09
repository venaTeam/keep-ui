import { test as base } from "@playwright/test";
import { KeepApi } from "./keep-api";

export const env = {
  gateway: process.env.GATEWAY_URL ?? "http://localhost:8080",
  workflows: process.env.WORKFLOWS_URL ?? "http://localhost:8081",
  uiBaseUrl: process.env.UI_BASE_URL ?? "http://localhost:3000",
  apiKey: process.env.KEEP_API_KEY ?? "keep-sanity-check",
};

/**
 * Extends Playwright's `test` with a `{ api }` fixture (the REST helper).
 * Under AUTH_TYPE=noauth the UI needs no login, so there is no storageState —
 * specs navigate directly and the API helper carries the x-api-key.
 */
export const test = base.extend<{ api: KeepApi }>({
  api: async ({}, use) => {
    await use(new KeepApi({ gateway: env.gateway, workflows: env.workflows, apiKey: env.apiKey }));
  },
});

export { expect } from "@playwright/test";
