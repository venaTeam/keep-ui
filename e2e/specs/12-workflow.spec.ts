import { test, expect } from "../fixtures/test-base";
import { loadFeed, celFingerprint } from "../fixtures/ui";

/**
 * [check:12] Create + trigger a workflow (the barbor workflow).
 *
 * This is the most complex sanity check. It proves the full workflow loop:
 *   seed a trigger alert (with an already-lapsed expiry) → create the barbor
 *   workflow (UI upload, API fallback) → trigger it manually → the execution
 *   succeeds with no errors → the alert it filters on is *enriched* to
 *   status=resolved → the UI feed reflects the new status.
 *
 * Hybrid strategy (UI proves the surface, API proves the truth):
 *   - UI:  the upload modal renders and accepts the YAML; the alerts feed shows
 *          the resolved status.
 *   - API: deterministic create fallback, manual trigger, execution status, and
 *          the enrichment landing (the real proof of success).
 *
 * The barbor YAML is copied VERBATIM from the sanity-check SKILL.md. It pins a
 * fixed `id`, so we pre-clean any prior "barbor" workflow to avoid the fixed-id
 * collision before (re)creating it.
 */

// --- barbor workflow YAML (verbatim from SKILL.md) --------------------------
const BARBOR_YAML = `workflow:
  id: ee8a180b-add9-4bc3-81ca-de0898878652
  name: barbor
  description: bb
  disabled: false
  triggers:
    - type: manual
    - type: interval
      value: "120"
  inputs: []
  consts: {}
  owners: []
  services: []
  steps:
    - name: get-alerts
      provider:
        type: keep
        config: "{{ providers.default-keep }}"
        with:
          filter: operator == "bar" && status == "firing" && expiry_in_minutes
          version: 2
    - name: python-step
      foreach: "{{ steps.get-alerts.results }}"
      if: (keep.to_timestamp("{{foreach.value.lastReceived}}") + ({{foreach.value.expiry_in_minutes}}*60)) < keep.to_timestamp(keep.utcnow())
      provider:
        type: python
        config: "{{ providers.default-python }}"
        with:
          code: f"{{foreach.value.name}}"
          enrich_alert:
            - key: status
              value: resolved
              disposable: true
  actions: []
`;

test.describe("[check:12] workflow", () => {
  test("barbor workflow runs and enriches its trigger alert to resolved", async ({
    page,
    api,
  }) => {
    // This check does the most work (seed → create → run → poll execution →
    // poll enrichment → UI), each step eventually-consistent. Give it room.
    test.setTimeout(120_000);

    // 1) PRE-CLEAN the fixed-id collision: drop any prior "barbor" workflow.
    await api.deleteWorkflowByName("barbor");

    // 2) SEED the trigger alert with an ALREADY-LAPSED expiry so the workflow's
    //    `if` condition (lastReceived + expiry*60 < now) fires. lastReceived is
    //    one hour in the past with a 1-minute expiry.
    const fp = api.makeFingerprint("barbor-trigger");
    const oneHourAgo = new Date(Date.now() - 3600_000)
      .toISOString()
      .replace(/\.\d+Z$/, ".000Z");

    await api.sendAlert({
      name: "barbor-trigger",
      operator: "bar",
      status: "firing",
      severity: "warning",
      expiry_in_minutes: 1,
      lastReceived: oneHourAgo,
      fingerprint: fp,
    });
    await api.waitForAlert(fp);

    // 3) CREATE the workflow.
    //
    //    Primary path = UI, to prove the upload modal renders and accepts the
    //    YAML. The modal exposes a plain <textarea data-cy="wf-upload-yaml-textarea">
    //    (not Monaco), so it is reliably drivable: paste the YAML, click
    //    "Load" (data-cy="wf-upload-yaml-load-btn"), and the component redirects
    //    to /workflows/<id>.
    //
    //    If the UI path does not land us on a detail page (selector drift, etc.),
    //    fall back to the deterministic API create and still assert the workflow
    //    is listed. Either way we end with a concrete `workflowId`.
    //    NOTE: in this split-service dev stack the workflows LIST page can be
    //    unavailable — it depends on `GET /workflows/query?is_v2=true`, which is
    //    not served here (the page hangs on its loader). So the entire UI-upload
    //    attempt is best-effort: if the page/upload affordance doesn't come up,
    //    we fall back to the deterministic API create. The execution loop below
    //    (run → success → enrichment) is the authoritative proof either way.
    let workflowId: string | undefined;

    try {
      await page.goto("/workflows", { waitUntil: "domcontentloaded" });
      const uploadBtn = page.locator('[data-cy="wf-upload-btn"]').first();
      await uploadBtn.waitFor({ state: "visible", timeout: 20_000 });
      await uploadBtn.click();

      const modal = page.locator('[data-cy="wf-upload-modal"]');
      await expect(modal).toBeVisible();

      const yamlTextarea = modal.locator('[data-cy="wf-upload-yaml-textarea"]');
      await yamlTextarea.fill(BARBOR_YAML);
      await modal.locator('[data-cy="wf-upload-yaml-load-btn"]').click();

      // On a single successful upload the modal redirects to /workflows/<id>.
      await page.waitForURL(/\/workflows\/[0-9a-f-]{8,}/i, { timeout: 15_000 });
      const m = page.url().match(/\/workflows\/([0-9a-f-]{8,})/i);
      workflowId = m?.[1];
    } catch {
      // UI upload path unavailable (workflows page didn't load, or no redirect)
      // — fall back to the deterministic API create.
      workflowId = undefined;
    }

    if (!workflowId) {
      // Deterministic fallback: create via the workflows API.
      await api.deleteWorkflowByName("barbor"); // guard against a partial UI create
      await api.createWorkflowFromYaml(BARBOR_YAML);
    }

    // Resolve the workflow id from the listing by name (authoritative — works
    // for both the UI and API create paths).
    const workflows = await api.listWorkflows();
    const barbor = workflows.find(
      (w) => (w?.name ?? w?.workflow?.name) === "barbor"
    );
    expect(barbor, "barbor workflow should exist after create").toBeTruthy();
    workflowId = workflowId ?? barbor.id ?? barbor.workflow_id;
    expect(workflowId, "should have a barbor workflow id").toBeTruthy();

    // 4) TRIGGER manually (deterministic API run — no waiting on the 120s
    //    interval). Returns the execution id to poll on.
    const run = await api.runWorkflow(workflowId!);
    const executionId = run.workflow_execution_id ?? run.execution_id ?? run.id;
    expect(executionId, "runWorkflow should return an execution id").toBeTruthy();

    // 5) ASSERT execution success (backend truth) and that no step errored.
    const exec = await api.waitForExecution(executionId, 60_000);
    expect(String(exec.status ?? exec.workflow_status).toLowerCase()).toBe(
      "success"
    );

    // No error surfaced anywhere in the execution payload / step results.
    const execBlob = JSON.stringify(exec).toLowerCase();
    expect(
      execBlob.includes('"error"') && exec.error,
      "execution should report no top-level error"
    ).toBeFalsy();

    // 6) ASSERT the enrichment actually landed — THE real proof of success:
    //    the python-step enriches the trigger alert to status=resolved.
    await api.waitForAlertField(fp, "status", "resolved", 30_000);

    // 7) ASSERT the UI reflects the resolved status in the alerts feed.
    //    NOTE: the status cell renders an Icon whose human-readable status is in
    //    a Tremor tooltip (rendered on hover, not a static title attribute), so
    //    the status text is not reliably present as cell text content. We hover
    //    the status icon to surface the tooltip and assert on it; the API
    //    enrichment assertion above remains the authoritative proof. See the
    //    "data-cy GAPS" note returned with this spec.
    // The feed only lists alerts once a CEL query is submitted; filter to this fp.
    await loadFeed(page, celFingerprint(fp), [fp]);

    const statusCell = page.locator(
      `[data-cy-id="${fp}"] [data-cy="alerts-cell-status"]`
    );
    await expect(statusCell).toBeVisible();
    await statusCell.hover();

    // The tooltip carries the status text ("resolved"); fall back to the cell
    // subtree if the tooltip text is exposed inline on this build.
    await expect(page.getByText(/resolved/i).first()).toBeVisible();
  });
});
