import { expect, type Page } from "@playwright/test";

/**
 * Helpers for loading the alerts feed with a CEL filter applied, resilient to
 * the Next.js *dev server's* flakiness (the sanity-check stack runs `npm run
 * dev`, not a production build).
 *
 * Why this needs to be defensive — the same check could pass once and fail the
 * next run because of three timing-dependent, dev-only behaviours:
 *
 *  1. CEL not applied via the editor. The Monaco CEL input only commits on Enter
 *     when `isValidCEL` is already true and no autocomplete popup is open
 *     (features/presets/presets-manager/ui/alerts-rules-builder.tsx
 *     handleKeyDown). CEL validation runs async as you type, so an Enter fired
 *     right after typing is frequently swallowed → filter never applied
 *     ("Enter to apply" hint stays visible, feed shows its empty state).
 *  2. CEL not applied via the URL. The `cel` query param IS read on mount
 *     (features/cel-input/use-cel-state.ts), but under React Strict Mode the
 *     hook's cleanup effect double-fires on mount and strips the param,
 *     resetting appliedCel to empty — so the URL param alone is unreliable.
 *  3. Hydration crashes. The alerts table emits real DOM-nesting hydration
 *     errors in dev (e.g. a <div> rendered inside <tr>), which intermittently
 *     escalate to a full client-side "Application error" page.
 *
 * Strategy: navigate with the `cel` URL param (deterministic pre-fill of the
 * query), reload if a client-side crash is showing, and — only if the filter
 * still isn't applied — commit it via the editor. Then poll for the expected
 * row(s), RE-NAVIGATING on each attempt so a Strict-Mode param strip or a
 * transient hydration crash is simply retried rather than failing the check.
 */

/** CEL for a single alert by fingerprint. */
export const celFingerprint = (fp: string) => `fingerprint == "${fp}"`;

/** CEL matching a set of fingerprints (e.g. the bulk-assign group). */
export const celFingerprintIn = (fps: string[]) =>
  fps.map((fp) => `fingerprint == "${fp}"`).join(" || ");

const rowLocator = (page: Page, fingerprint: string) =>
  page.locator(`[data-cy="alerts-row"][data-cy-id="${fingerprint}"]`);

/** One navigate + apply attempt (no row assertions). */
async function navigateAndApply(page: Page, cel: string): Promise<void> {
  await page.goto(`/alerts/feed?cel=${encodeURIComponent(cel)}`, {
    waitUntil: "domcontentloaded",
  });

  // Recover from an intermittent dev-mode client-side crash.
  if (await page.getByText("Application error").count().catch(() => 0)) {
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  // Wait for the CEL editor to mount.
  const editor = page.locator('[data-cy="cel-input"]');
  await editor.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});

  // If the URL pre-fill applied, the "Enter to apply" hint is absent and we're
  // done. Otherwise commit explicitly: retype from a clean slate (the param may
  // have been stripped) and press Enter, dismissing any autocomplete first.
  const applyHint = page.getByText("Enter to apply", { exact: false });
  if (await applyHint.count().catch(() => 0)) {
    await editor.click().catch(() => {});
    await page.keyboard.press("ControlOrMeta+A").catch(() => {});
    await page.keyboard.press("Backspace").catch(() => {});
    await page.keyboard.type(cel, { delay: 15 }).catch(() => {});
    await page.keyboard.press("Escape").catch(() => {}); // close autocomplete
    await page.keyboard.press("Enter").catch(() => {});
  }
}

/**
 * Load the feed with `cel` applied and wait until every fingerprint in
 * `expectFingerprints` has a visible row. Re-navigates on each poll attempt so
 * dev-mode param-strips / hydration crashes are retried, not fatal.
 */
export async function loadFeed(
  page: Page,
  cel: string,
  expectFingerprints: string[] = []
): Promise<void> {
  await expect(async () => {
    await navigateAndApply(page, cel);
    for (const fp of expectFingerprints) {
      await expect(rowLocator(page, fp)).toBeVisible({ timeout: 6_000 });
    }
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 3_000] });
}

/** Load the feed filtered to exactly one alert and return its row locator. */
export async function loadFeedRow(page: Page, fingerprint: string) {
  await loadFeed(page, celFingerprint(fingerprint), [fingerprint]);
  return rowLocator(page, fingerprint);
}

/**
 * Enable a non-default alerts-table column via the settings popover
 * (settings-button → Columns tab → column checkbox → save). Many columns
 * (assignee, application, …) are hidden by default — see DEFAULT_COLS in
 * widgets/alerts-table/lib/alert-table-utils.tsx — so a render assertion on
 * their cell needs the column turned on first.
 */
export async function enableColumn(page: Page, columnId: string): Promise<void> {
  await page.locator('[data-cy="settings-button"]').click();
  await expect(page.locator('[data-cy="settings-panel"]')).toBeVisible();
  await page.locator('[data-cy="tab-columns"]').click();
  await expect(page.locator('[data-cy="panel-columns"]')).toBeVisible();

  const checkbox = page.locator(`[data-cy="column-checkbox-${columnId}"]`);
  await checkbox.scrollIntoViewIfNeeded();
  if (!(await checkbox.isChecked())) {
    await checkbox.check();
  }
  await page.locator('[data-cy="alerts-columns-save-btn"]').click();
}
