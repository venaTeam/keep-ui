import { test as base } from "@playwright/test";
import { KeepApi } from "./keep-api";
import {
  AlertsFeedPage,
  IncidentsPage,
  DashboardPage,
  WorkflowsPage,
  CreateMwPage,
  CorrelationPage,
  DeduplicationPage,
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
  mw: CreateMwPage;
  correlation: CorrelationPage;
  deduplication: DeduplicationPage;
};

export const test = base.extend<Fixtures>({
  // Hide the Next.js dev-mode overlay on every page. When the UI is served by
  // `next dev`, the dev-tools indicator / error overlay render inside a
  // <nextjs-portal> fixed to a screen corner that INTERCEPTS pointer events —
  // Playwright then can't click controls beneath it (e.g. the correlation
  // sidebar's "Create correlation" submit button), the click times out, and the
  // action silently no-ops. The portal is dev-only (absent in production), so
  // hiding it makes tests behave like the real build. addInitScript re-runs on
  // every navigation; the injected <style> persists across client-side routing.
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const inject = () => {
        const style = document.createElement("style");
        style.setAttribute("data-e2e-hide-nextjs-overlay", "");
        style.textContent = "nextjs-portal{display:none !important;}";
        document.head?.appendChild(style);
      };
      if (document.head) inject();
      else document.addEventListener("DOMContentLoaded", inject);
    });
    await use(page);
  },
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
  mw: async ({ page }, use) => {
    await use(new CreateMwPage(page))
  },
  correlation: async ({ page }, use) => {
    await use(new CorrelationPage(page));
  },
  deduplication: async ({ page }, use) => {
    await use(new DeduplicationPage(page));
  },
});

export { expect } from "@playwright/test";
