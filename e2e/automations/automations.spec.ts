import { test, expect } from "@playwright/test";
const featureOff = process.env.AUTOMATIONS_TEST_FLAG_OFF === "true";
const readOnly = process.env.AUTOMATIONS_TEST_READ_ONLY === "true";
test.beforeEach(async ({ page, request }) => {
  await request.post("http://127.0.0.1:4199/__reset");
  await page.goto(`/signin?callbackUrl=${encodeURIComponent("/automations")}`);
  await page.waitForURL((url) => url.pathname === "/automations");
});
test("feature-off hides navigation and rejects direct routes and BFF", async ({
  page,
}) => {
  test.skip(!featureOff);
  await expect(page.getByRole("heading", { name: "Automations" })).toHaveCount(
    0
  );
  await expect(page.locator('[data-cy="nav-link-automations"]')).toHaveCount(0);
  const response = await page.request.get("/backend/automations");
  expect(response.status()).toBe(404);
  await page.goto("/automations/payments");
  await expect(page.getByRole("heading", { name: "Automations" })).toHaveCount(
    0
  );
});
test("read-only disables lifecycle and edit", async ({ page }) => {
  test.skip(featureOff || !readOnly);
  await page.getByRole("link", { name: "Restart payments" }).click();
  await expect(
    page.getByRole("button", { name: "Disable", exact: true })
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Edit", exact: true })
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Delete", exact: true })
  ).toBeDisabled();
});
test.describe("enabled", () => {
  test.beforeEach(() => test.skip(featureOff || readOnly));
  test("list -> all filters -> detail -> back preserves filters through BFF", async ({
    page,
    request,
  }) => {
    await expect(
      page.getByRole("link", { name: "Restart payments" })
    ).toBeVisible();
    await page.getByRole("checkbox", { name: "payments", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "payments", exact: true })
    ).toBeChecked();
    await page.getByRole("checkbox", { name: "active", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "active", exact: true })
    ).toBeChecked();
    await page.getByRole("checkbox", { name: "idle", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "idle", exact: true })
    ).toBeChecked();
    await expect(
      page.getByRole("link", { name: "Building automation" })
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Restart payments" }).click();
    await expect(
      page.getByText("Contract version", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("def handle(alert):", { exact: false })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Edit", exact: true })
    ).toHaveAttribute("href", "/automations/payments/edit");
    await page.getByRole("link", { name: "Back to automations" }).click();
    await expect(
      page.getByRole("checkbox", { name: "payments", exact: true })
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "active", exact: true })
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "idle", exact: true })
    ).toBeChecked();
    const calls = await (
      await request.get("http://127.0.0.1:4199/__requests")
    ).json();
    expect(
      calls.some(
        (call: { path: string; authorization?: string }) =>
          call.path === "/automations" &&
          call.authorization?.startsWith("Bearer ")
      )
    ).toBe(true);
  });
  test("search combines with facets, survives navigation, and sidebar preference persists", async ({
    page,
    request,
  }) => {
    await page.getByPlaceholder("Search automations").fill("PAYMENTS");
    await expect(page).toHaveURL(/q=PAYMENTS/);
    await expect(
      page.getByRole("link", { name: "Unbuilt automation" })
    ).toHaveCount(0);
    await page.getByRole("checkbox", { name: "idle", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "idle", exact: true })
    ).toBeChecked();
    await expect(page.locator('[data-cy="automation-card"]')).toHaveCount(1);
    await page.getByRole("link", { name: "Restart payments" }).click();
    await page.getByRole("link", { name: "Back to automations" }).click();
    await expect(page.getByPlaceholder("Search automations")).toHaveValue(
      "PAYMENTS"
    );
    await expect(
      page.getByRole("checkbox", { name: "idle", exact: true })
    ).toBeChecked();
    await page.getByRole("button", { name: "Hide filters" }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Show filters" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Show filters" }).click();
    await page.getByPlaceholder("Search automations").fill("does-not-exist");
    await expect(
      page.getByText("No automations match your search.")
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    await expect(page.getByPlaceholder("Search automations")).toHaveValue("");
    await expect(
      page.getByRole("checkbox", { name: "idle", exact: true })
    ).toBeChecked();
    const calls = await (
      await request.get("http://127.0.0.1:4199/__requests")
    ).json();
    expect(
      calls
        .filter((call: { path: string }) => call.path === "/automations")
        .every(
          (call: { search: string }) =>
            !new URLSearchParams(call.search).has("q")
        )
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByPlaceholder("Search automations")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
  });
  test("facets support multiple values and contextual counts", async ({
    page,
  }) => {
    const facets = page.locator('[data-cy="automations-facets"]');
    await expect(
      facets
        .getByRole("group", { name: "payments", exact: true })
        .locator('[data-cy="facet-value-count"]')
    ).toHaveText("3");
    await page.getByRole("checkbox", { name: "payments", exact: true }).click();
    await expect(page.locator('[data-cy="automation-card"]')).toHaveCount(3);
    await page.getByRole("checkbox", { name: "platform", exact: true }).click();
    await expect(page.locator('[data-cy="automation-card"]')).toHaveCount(4);
    await expect(page).toHaveURL(/namespace=payments&namespace=platform/);
    await page.getByRole("checkbox", { name: "idle", exact: true }).click();
    await expect(page.locator('[data-cy="automation-card"]')).toHaveCount(2);
    await expect(
      facets
        .getByRole("group", { name: "payments", exact: true })
        .locator('[data-cy="facet-value-count"]')
    ).toHaveText("1");
    await page.getByRole("link", { name: "Restart payments" }).click();
    await page.getByRole("link", { name: "Back to automations" }).click();
    await expect(
      page.getByRole("checkbox", { name: "payments", exact: true })
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "platform", exact: true })
    ).toBeChecked();
    await page
      .getByRole("button", { name: "Clear build state", exact: true })
      .click();
    await expect(page.locator('[data-cy="automation-card"]')).toHaveCount(4);
    const payments = facets.getByRole("group", {
      name: "payments",
      exact: true,
    });
    await payments.hover();
    await payments.getByRole("button", { name: "Only", exact: true }).click();
    await expect(page.locator('[data-cy="automation-card"]')).toHaveCount(3);
  });
  test("disable confirms, refreshes lists, then enable is immediate", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Restart payments" }).click();
    await page.getByRole("button", { name: "Disable", exact: true }).click();
    await expect(
      page.getByText(/Existing executions can finish/)
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Disable automation", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Enable", exact: true })
    ).toBeEnabled();
    await expect(
      page.getByText("def handle(alert):", { exact: false })
    ).toBeVisible();
    await page.getByRole("link", { name: "Back to automations" }).click();
    await expect(
      page
        .locator('[data-cy="automation-card"]')
        .filter({ hasText: "Restart payments" })
    ).toContainText("inactive");
    await page.getByRole("link", { name: "Restart payments" }).click();
    await page.getByRole("button", { name: "Enable", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Disable", exact: true })
    ).toBeEnabled();
  });
  test("missing digest has pointer and keyboard tooltip and no enable request", async ({
    page,
    request,
  }) => {
    await page.getByRole("link", { name: "Unbuilt automation" }).click();
    await expect(
      page.getByRole("button", { name: "Enable", exact: true })
    ).toBeDisabled();
    const help = page.locator('[data-cy="automation-toggle-help"]');
    await help.hover();
    await expect(page.getByRole("tooltip")).toContainText(
      "first successful build"
    );
    await page.mouse.move(0, 0);
    await help.focus();
    await expect(page.getByRole("tooltip")).toContainText(
      "first successful build"
    );
    const calls = await (
      await request.get("http://127.0.0.1:4199/__requests")
    ).json();
    expect(
      calls.some((call: { path: string }) => call.path.endsWith("/enable"))
    ).toBe(false);
  });
  test("delete warns, cancel sends nothing, confirm shows deleting then deleted", async ({
    page,
    request,
  }) => {
    await page.getByRole("link", { name: "Restart payments" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "may terminate executions already running"
    );
    await expect(page.getByRole("dialog")).toContainText(
      "does not wait for running executions to finish"
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    const calls = await (
      await request.get("http://127.0.0.1:4199/__requests")
    ).json();
    expect(
      calls.some((call: { method: string }) => call.method === "DELETE")
    ).toBe(false);
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("button", { name: "Delete automation", exact: true })
      .click();
    await expect(page.getByText("deleting", { exact: true })).toBeVisible();
    await expect(page.getByText("deleted", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete", exact: true })
    ).toBeDisabled();
  });
  test("building restricts edit and delete but allows disable; Edit navigates to handoff", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Building automation" }).click();
    await expect(
      page.getByRole("button", { name: "Edit", exact: true })
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Delete", exact: true })
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Disable", exact: true })
    ).toBeEnabled();
    await page.getByRole("link", { name: "Back to automations" }).click();
    await page.getByRole("link", { name: "Restart payments" }).click();
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await expect(page).toHaveURL(/\/automations\/payments\/edit$/);
  });
  test("namespace failure has retry, unused wallet has no matches, 404 is unavailable", async ({
    page,
    request,
  }) => {
    await request.post("http://127.0.0.1:4199/__scenario", {
      data: { namespacesError: true },
    });
    await page.reload();
    await expect(
      page.getByText("Namespace options could not be loaded.", { exact: false })
    ).toBeVisible();
    await request.post("http://127.0.0.1:4199/__scenario", { data: {} });
    await page.getByRole("button", { name: "Retry namespace options" }).click();
    await page
      .getByRole("checkbox", { name: "unused-wallet", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "unused-wallet", exact: true })
    ).toBeChecked();
    await expect(
      page.getByText("No automations match these filters.")
    ).toBeVisible();
    await page.goto("/automations/missing");
    await expect(
      page.getByText("Automation unavailable or not found.", { exact: false })
    ).toBeVisible();
  });
});
