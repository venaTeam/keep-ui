import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The dashboard surface.
 *
 * A dashboard is created through the real UI affordance: the "Add Dashboard"
 * button in the sidebar nav (DashboardLinks.tsx, data-cy="nav-btn-add-dashboard").
 * Clicking it auto-generates a unique name ("My Dashboard", "My Dashboard(1)", …)
 * and opens a brand-new (unsaved) dashboard; Save then persists it via
 * POST /dashboard. The name is chosen by the app, not the test — `addViaNav()`
 * reads it back off the rendered page.
 *
 * Locators are centralized in the `locators` map; methods reference it.
 */
export class DashboardPage {
  readonly locators: {
    root: Locator;
    name: Locator;
    addButton: Locator;
    saveButton: Locator;
    navLink: (name: string) => Locator;
  };

  constructor(readonly page: Page) {
    this.locators = {
      root: page.locator('[data-cy="dashboard-page"]'),
      name: page.locator('[data-cy="dashboard-name"]'),
      // Sidebar "Add Dashboard" button (DashboardLinks renders it in the nav).
      addButton: page.locator('[data-cy="nav-btn-add-dashboard"]'),
      saveButton: page.locator('[data-cy="dashboard-save-layout-btn"]'),
      // Sidebar nav link for a saved dashboard (DashboardLink renders the name).
      navLink: (name) =>
        page
          .locator('[data-cy^="nav-link-dashboard-"]')
          .filter({ hasText: name }),
    };
  }

  /**
   * Create a new dashboard via the sidebar "Add Dashboard" button and return the
   * app-generated name. The button lives in the global nav, so we first land on
   * a page that renders the nav shell, click Add, wait for the dashboard page,
   * and read the generated name off `dashboard-name`.
   *
   * The button sits at the very bottom of the sidebar's Dashboards group, below
   * every seeded preset/dashboard, inside that group's own scroll container — so
   * on a populated nav it starts below the fold. The dashboard list also loads
   * async and grows after first paint, which can shift the button out from under
   * a settled click. So scroll it into view and retry click → navigation until
   * the URL actually changes to /dashboard/<name>.
   */
  async addViaNav(): Promise<string> {
    await this.page.goto("/", { waitUntil: "domcontentloaded" });

    const addButton = this.locators.addButton;
    await addButton.waitFor({ state: "attached", timeout: 20_000 });

    await expect(async () => {
      await addButton.scrollIntoViewIfNeeded();
      await addButton.click();
      await this.page.waitForURL(/\/dashboard\//, { timeout: 5_000 });
    }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 3_000] });

    await expect(this.locators.root).toBeVisible();
    const name = (await this.locators.name.textContent())?.trim() ?? "";
    return name;
  }

  get root(): Locator {
    return this.locators.root;
  }
  get name(): Locator {
    return this.locators.name;
  }
  get saveButton(): Locator {
    return this.locators.saveButton;
  }
  navLink(name: string): Locator {
    return this.locators.navLink(name);
  }
}
