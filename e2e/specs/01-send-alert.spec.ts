import { test, expect } from "../fixtures/test-base";

/**
 * [check:01] send-alert
 *
 * The most basic end-to-end path: ingest a single alert through the gateway,
 * wait for it to land in the backend (firing), then assert the alerts feed
 * renders its row.
 */

test.describe("[check:01] send-alert", () => {
  test("an ingested alert lands firing in the backend and renders in the feed", async ({
    alertsFeed,
    api,
  }) => {
    const { fingerprint, status } = await api.alerts.sendAlert({ name: "sanity-send" });

    // The gateway accepts the alert event asynchronously → 202 Accepted.
    expect(status).toBe(202);

    const alert = await api.alerts.waitForAlert(fingerprint);
    expect(alert).toBeTruthy();
    expect(alert.status).toBe("firing");

    const row = await alertsFeed.loadFeedRow(fingerprint);
    await expect(row.root).toBeVisible();
  });
});
