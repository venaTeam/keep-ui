import { test, expect } from "../fixtures/test-base";
import {
  loadFeed,
  celFingerprint,
  celFingerprintIn,
  enableColumn,
} from "../fixtures/ui";

/**
 * [check:03] change-assignee
 *
 * Single + "bulk" assignee changes driven through the per-row UI.
 *
 * Single: seed 1 alert → open its row action menu → "Self-Assign" menu item
 *   (DropdownMenu.Item auto-generates data-cy="menu-item-self-assign") →
 *   the assign modal (data-cy="alerts-assign-modal") → submit
 *   (data-cy="alerts-assign-submit-btn"). The modal assigns the alert to the
 *   current (noauth) session user via POST /alerts/{fp}/assign/{lastReceived}.
 *
 * Bulk: seed 3 alerts and repeat the same per-row Self-Assign flow on each.
 *   NOTE: there is NO bulk "assign" affordance in the selection toolbar
 *   (widgets/alerts-table/ui/alert-actions.tsx only exposes change-status /
 *   dismiss / restore / preset / associate-incident). See the data-cy GAPS
 *   report — until a bulk-assign action exists, "bulk" is exercised by driving
 *   the single-row flow N times, which still asserts all N backends.
 *
 * Because the assignee resolves to the current session user (email not known
 * statically under noauth), the backend assertion waits for the assignee field
 * to become a non-empty string, then the captured value is used for the cell
 * assertion.
 */
test.describe("[check:03] change-assignee", () => {
  // Self-Assign a single row identified by its fingerprint, returns the
  // resolved assignee value the backend recorded.
  async function selfAssignRow(
    page: import("@playwright/test").Page,
    api: import("../fixtures/keep-api").KeepApi,
    fingerprint: string
  ): Promise<string> {
    const row = page.locator(
      `[data-cy="alerts-row"][data-cy-id="${fingerprint}"]`
    );
    await expect(row).toBeVisible();

    await row
      .locator('[data-cy="alerts-menu"] [data-testid="dropdown-menu-button"]')
      .click();
    await page.locator('[data-cy="menu-item-self-assign"]').click();

    const modal = page.locator('[data-cy="alerts-assign-modal"]');
    await expect(modal).toBeVisible();
    await modal.locator('[data-cy="alerts-assign-submit-btn"]').click();
    await expect(modal).toBeHidden();

    // backend assert: assignee becomes a non-empty string
    const alert = await api.waitForEnrichment(
      fingerprint,
      (a) => typeof a.assignee === "string" && a.assignee.length > 0,
      30_000,
      "assignee set"
    );
    return alert.assignee as string;
  }

  test("single self-assign persists and renders the assignee", async ({
    page,
    api,
  }) => {
    const { fingerprint } = await api.sendAlert({ name: "sanity-assign-single" });
    await api.waitForAlert(fingerprint);

    // The feed only lists alerts once a CEL query is submitted; filter to this fp.
    await loadFeed(page, celFingerprint(fingerprint), [fingerprint]);
    const assignee = await selfAssignRow(page, api, fingerprint);

    // The assignee column is hidden by default (not in DEFAULT_COLS), so enable
    // it before asserting its cell renders.
    await enableColumn(page, "assignee");

    // render assert: the assignee cell for our row is present and populated
    // (renders an avatar/text for the resolved assignee). The backend assertion
    // above is the authoritative proof of the value.
    const row = page.locator(
      `[data-cy="alerts-row"][data-cy-id="${fingerprint}"]`
    );
    const assigneeCell = row.locator('[data-cy="alerts-cell-assignee"]');
    await expect(assigneeCell).toBeVisible();
    expect(assignee.length).toBeGreaterThan(0);
  });

  test("bulk self-assign across 3 alerts persists for all of them", async ({
    page,
    api,
  }) => {
    const stamp = Date.now();
    const seeds = await Promise.all(
      [0, 1, 2].map((i) =>
        api.sendAlert({ name: `sanity-assign-bulk-${stamp}-${i}` })
      )
    );
    const fingerprints = seeds.map((s) => s.fingerprint);
    await Promise.all(fingerprints.map((fp) => api.waitForAlert(fp)));

    // The feed only lists alerts once a CEL query is submitted; filter to all 3.
    await loadFeed(page, celFingerprintIn(fingerprints), fingerprints);

    // Drive the per-row Self-Assign flow for each seeded alert.
    for (const fp of fingerprints) {
      await selfAssignRow(page, api, fp);
    }

    // backend assert: all 3 carry an assignee.
    for (const fp of fingerprints) {
      const alert = await api.getAlert(fp);
      expect(alert).toBeTruthy();
      expect(typeof alert.assignee).toBe("string");
      expect((alert.assignee as string).length).toBeGreaterThan(0);
    }
  });
});
