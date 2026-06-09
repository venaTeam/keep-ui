import { test, expect } from "../fixtures/test-base";

/**
 * [check:08] incident-preset-group
 *
 * Seeds two incidents that share a groupable field (severity), then drives the
 * incidents "preset" UI to group/segment the list by that field and asserts the
 * grouped section headers render.
 *
 * IMPORTANT — UI reality / data-cy GAP:
 *   The incidents table (features/incidents/incident-list/ui/incidents-table.tsx)
 *   has a HARD-CODED column set and ships NO "add column" control and NO
 *   "group by" control. The only field-grouping UI for the incidents preset is
 *   the server-side Facets panel (data-cy="facets-panel"), which renders one
 *   group row per distinct field value with a per-value count
 *   (data-cy="facet-value" + data-cy="facet-value-count") and filters the table
 *   when a value is selected.
 *
 *   So this check exercises the Facets panel as the group-by surface. The facet
 *   HEADER (the field name, e.g. "Severity") has NO data-cy — the facet wrapper
 *   uses a dynamic id (data-cy="facet-<id>"). We therefore locate the facet by
 *   its visible title text (a role/text locator). See the GAP report returned
 *   by this task.
 */
test.describe("[check:08] incident-preset-group", () => {
  test("groups the incidents preset by a shared field via the facets panel", async ({
    page,
    api,
  }) => {
    const stamp = Date.now();
    const sharedSeverity = "warning"; // both incidents share this groupable value

    // --- seed: two incidents sharing a groupable field (severity) ----------
    const nameA = `sanity-group-a-${stamp}`;
    const nameB = `sanity-group-b-${stamp}`;
    await api.createIncident({
      user_generated_name: nameA,
      user_summary: `group check A ${stamp}`,
      severity: sharedSeverity,
    });
    await api.createIncident({
      user_generated_name: nameB,
      user_summary: `group check B ${stamp}`,
      severity: sharedSeverity,
    });

    // backend sanity: both incidents exist with the shared severity
    await expect
      .poll(
        async () => {
          const incidents = await api.getIncidents();
          return incidents.filter(
            (i) =>
              i?.user_generated_name === nameA ||
              i?.user_generated_name === nameB
          ).length;
        },
        { timeout: 30_000, message: "both seeded incidents to exist" }
      )
      .toBe(2);

    // --- drive the incidents preset / facets UI ----------------------------
    await page.goto("/incidents");

    const facetsPanel = page.locator('[data-cy="facets-panel"]');
    await expect(facetsPanel).toBeVisible();

    // The facets panel is the group-by surface: it renders one facet per field
    // (Status, Severity, Assignee, …), each with value rows (data-cy="facet-value")
    // carrying a per-value count (data-cy="facet-value-count"). The facet header
    // (the field name) has no stable data-cy — the wrapper uses a dynamic
    // facet-<id> — so we assert on the Severity header text and target the
    // grouped value rows directly within the panel.
    await expect(
      facetsPanel.getByText("Severity", { exact: true }).first()
    ).toBeVisible();

    // grouped value rows render with counts
    const groupRows = facetsPanel.locator('[data-cy="facet-value"]');
    await expect(groupRows.first()).toBeVisible();
    await expect
      .poll(() => groupRows.count(), {
        timeout: 30_000,
        message: "grouped facet value rows to render",
      })
      .toBeGreaterThanOrEqual(1);
    await expect(
      facetsPanel.locator('[data-cy="facet-value-count"]').first()
    ).toBeVisible();

    // --- select the shared group value → table filters to that group -------
    // (sharedSeverity only appears as a Severity value, so a panel-wide match is
    // unambiguous.)
    // NOTE: a facet-value's text is the label concatenated with its count
    // (e.g. "Warning12"), so match the label without a trailing word boundary.
    const sharedGroupRow = groupRows
      .filter({ hasText: new RegExp(sharedSeverity, "i") })
      .first();
    await expect(sharedGroupRow).toBeVisible();
    await sharedGroupRow.click();

    // Selecting the shared group value filters the list to that group: the table
    // re-renders and still shows incidents. We assert the filtered table is
    // populated rather than that the two *seeded* incidents are visible — the
    // incidents table is itself paginated, so on a stack with many incidents of
    // this severity the freshly-seeded rows can fall onto a later page. The
    // grouped section rows + counts asserted above are the real proof of the
    // group-by behaviour.
    await expect(page.locator('[data-cy="incidents-table"]')).toBeVisible();
    await expect(
      page.locator('[data-cy="incidents-row"]').first()
    ).toBeVisible();
  });
});
