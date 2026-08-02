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

  test('sending alert in resolved always resolves alert', async({alertsFeed, api, page}) => {
    const { fingerprint } = await api.alerts.sendAlert({ name: "sanity always resolved"})
    const alert = await api.alerts.waitForAlert(fingerprint)
    
    await api.alerts.changeStatus(fingerprint, "acknowledged" )
    const ackStatus = await api.alerts.waitForAlertField(fingerprint, "status", "acknowledged")
    expect(ackStatus.status).toBe('acknowledged')

    await api.alerts.sendAlert({fingerprint: fingerprint, name: "sanity send on resolved", status: "resolved"})
    await api.alerts.waitForAlert(fingerprint)
    const resolveStatus = await api.alerts.waitForAlertField(fingerprint, "status", "resolved")

    expect(resolveStatus.status).toBe("resolved")
    const row = await alertsFeed.loadFeedRow(fingerprint)
    const statusCell = alertsFeed.row(fingerprint).cell("status")
    await page.mouse.move(0, 0)
    await statusCell.hover()
    await expect(
      page.getByRole("tooltip").filter({hasText: /resolved/i }).first()
    ).toBeVisible()
  })
});
