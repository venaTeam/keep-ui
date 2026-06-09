import { test, expect } from "../fixtures/test-base";
import { loadFeedRow } from "../fixtures/ui";

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
    // The feed only lists alerts once a CEL query is submitted; filter to this fp.
    const row = await loadFeedRow(page, fingerprint);
    await expect(row).toBeVisible();
  });
});
