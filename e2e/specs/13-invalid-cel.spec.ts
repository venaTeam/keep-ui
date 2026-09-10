import { test, expect } from "../fixtures/test-base";
import { celFingerprint } from "../pages";

/**
 * [check:13] invalid-cel
 *
 * Applying an invalid CEL expression must be a local, recoverable event:
 *   - the alerts screen stays mounted (no error boundary, no redirect)
 *   - the route does not change
 *   - the draft the user typed is preserved
 *   - the exact existing message is shown directly beneath the CEL input
 * and then a valid expression must apply normally, without a reload.
 *
 * Hybrid:
 *  - seed via api.alerts.sendAlert
 *  - drive the real CEL input (AlertsFeedPage)
 *  - render-assert the inline error, the preserved draft, and recovery.
 *
 * `'some text'` parses as valid CEL but is a string, not a filter, so only the
 * backend can reject it - which is the point: no frontend heuristic is involved.
 */
const INVALID_CEL = "'some text'";
const INVALID_CEL_MESSAGE = "Invalid Common Expression Logic expression.";

test.describe("[check:13] invalid-cel", () => {
  test("invalid CEL is reported inline and a corrected expression recovers", async ({
    alertsFeed,
    page,
    api,
  }) => {
    const { fingerprint } = await api.alerts.sendAlert({ name: "sanity-cel" });
    await api.alerts.waitForAlert(fingerprint);

    const row = await alertsFeed.loadFeedRow(fingerprint);
    await expect(row.root).toBeVisible();

    const routeBefore = new URL(page.url()).pathname;
    const celInput = page.locator('[data-cy="cel-input"]');

    await celInput.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(INVALID_CEL, { delay: 15 });
    await page.keyboard.press("Escape"); // close autocomplete
    await page.keyboard.press("Enter");

    // The exact existing wording, directly beneath the input.
    const inlineError = page.locator('[data-cy="cel-error"]');
    await expect(inlineError).toBeVisible({ timeout: 15_000 });
    await expect(inlineError).toContainText(INVALID_CEL_MESSAGE);

    // Still on the alerts screen: no error boundary, no navigation.
    await expect(page.getByText("Application error")).toHaveCount(0);
    await expect(celInput).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(routeBefore);

    // The draft the user typed is still there to be corrected.
    await expect(celInput).toContainText(INVALID_CEL);

    // Correct it in place - no reload.
    await celInput.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(celFingerprint(fingerprint), { delay: 15 });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Enter");

    await expect(inlineError).toHaveCount(0, { timeout: 15_000 });
    await expect(alertsFeed.row(fingerprint).root).toBeVisible({
      timeout: 15_000,
    });
  });
});
