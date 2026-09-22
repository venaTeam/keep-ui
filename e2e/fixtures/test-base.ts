import { test as base } from "@playwright/test";
import { KeepApi } from "./keep-api";
import {
  AlertsFeedPage,
  IncidentsPage,
  DashboardPage,
  WorkflowsPage,
} from "../pages";

export const env = {
  gateway: process.env.GATEWAY_URL ?? "http://localhost:8080",
  workflows: process.env.WORKFLOWS_URL ?? "http://localhost:8082",
  uiBaseUrl: process.env.UI_BASE_URL ?? "http://localhost:3000",
  apiKey: process.env.KEEP_API_KEY ?? "keep-sanity-check",
};

/**
 * Fixtures available to every spec:
 *   api         — REST client that seeds data + asserts backend truth.
 *   alertsFeed  — Page Object for /alerts/feed (rows, modals, columns).
 *   incidents   — Page Object for /incidents (create form, table, facets, detail).
 *   dashboard   — Page Object for /dashboard/<name>.
 *   workflows   — Page Object for /workflows (YAML upload modal).
 *
 * Under AUTH_TYPE=noauth the UI needs no login, so there is no storageState —
 * specs navigate directly and the API helper carries the x-api-key.
 */
type Fixtures = {
  api: KeepApi;
  alertsFeed: AlertsFeedPage;
  incidents: IncidentsPage;
  dashboard: DashboardPage;
  workflows: WorkflowsPage;
};

export const test = base.extend<Fixtures>({
  api: async ({}, use) => {
    const api = new KeepApi({ gateway: env.gateway, workflows: env.workflows, apiKey: env.apiKey });
    // Snapshot existing resources, run the test, then delete whatever it created
    // (alerts, incidents, presets, dashboards, workflows) — even if the test failed.
    const baseline = await api.snapshotResources();
    await use(api);
    await api.cleanupSince(baseline);
  },
  alertsFeed: async ({ page }, use) => {
    await use(new AlertsFeedPage(page));
  },
  incidents: async ({ page }, use) => {
    await use(new IncidentsPage(page));
  },
  dashboard: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  workflows: async ({ page }, use) => {
    await use(new WorkflowsPage(page));
  },
});

export { expect } from "@playwright/test";
