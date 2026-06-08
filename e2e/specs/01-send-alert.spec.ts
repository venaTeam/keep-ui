import { test, expect } from "../fixtures/test-base";

/**
 * [check:01] send-alert
 *
 * The most basic end-to-end path: ingest a single alert through the gateway,
 * wait for it to land in the backend (firing), then assert the alerts feed
 * renders its row.
 *
 * Hybrid:
 *  - seed + backend-assert via api.sendAlert + api.waitForAlert
 *  - render-assert via the alerts feed row keyed by fingerprint.
 */
test.describe("[check:01] send-alert", () => {
  test("an ingested alert lands firing in the backend and renders in the feed", async ({
    page,
    api,
  }) => {
    // --- seed: one alert ----------------------------------------------------
    const { fingerprint } = await api.sendAlert({ name: "sanity-send" });

    // --- backend assert: the alert exists and is firing ---------------------
    const alert = await api.waitForAlert(fingerprint);
    expect(alert).toBeTruthy();
    expect(alert.status).toBe("firing");

    // --- render assert: the row shows up in the feed ------------------------
    await page.goto("/alerts/feed");
    await expect(
      page.locator(`[data-cy="alerts-row"][data-cy-id="${fingerprint}"]`)
    ).toBeVisible();
  });
});
