import { HttpClient, type KeepApiOptions } from "./http-client";
import { AlertsApi } from "./alerts.api";
import { IncidentsApi } from "./incidents.api";
import { PresetsApi } from "./presets.api";
import { DashboardsApi } from "./dashboards.api";
import { WorkflowsApi } from "./workflows.api";

/**
 * Snapshot of resource ids that already existed before a test ran. Cleanup diffs
 * against this so only resources CREATED by the test are deleted, leaving
 * static/system resources (built-in presets, other data) alone. An `undefined`
 * field means the baseline list failed and that type must NOT be cleaned
 * (deleting against an empty baseline would wipe everything).
 */
export interface ResourceSnapshot {
  incidents?: Set<string>;
  presets?: Set<string>;
  dashboards?: Set<string>;
  workflows?: Set<string>;
}

/**
 * The composed API client the `api` fixture exposes. Feature clients are reached
 * by namespace — `api.alerts.*`, `api.incidents.*`, `api.presets.*`,
 * `api.dashboards.*`, `api.workflows.*` — mirroring the per-feature page objects.
 * Shared identifier helpers (`makeFingerprint`, `nowUtc`) live on the root, and
 * the root also owns the per-test cleanup orchestration.
 */
export class KeepApi extends HttpClient {
  readonly alerts: AlertsApi;
  readonly incidents: IncidentsApi;
  readonly presets: PresetsApi;
  readonly dashboards: DashboardsApi;
  readonly workflows: WorkflowsApi;

  constructor(opts: KeepApiOptions) {
    super(opts);
    this.alerts = new AlertsApi(opts);
    this.incidents = new IncidentsApi(opts);
    this.presets = new PresetsApi(opts);
    this.dashboards = new DashboardsApi(opts);
    this.workflows = new WorkflowsApi(opts);
  }

  // ---- per-test cleanup ---------------------------------------------------
  /**
   * Snapshot existing resource ids so `cleanupSince` only removes what a test
   * created. A list that fails is left `undefined` so its type is skipped at
   * cleanup rather than diffed against an empty set (which would delete all).
   */
  async snapshotResources(): Promise<ResourceSnapshot> {
    const ids = async (
      fn: () => Promise<any[]>
    ): Promise<Set<string> | undefined> => {
      try {
        const list = await fn();
        return new Set(
          list.map((r) => String(r?.id ?? r?.workflow_id ?? "")).filter(Boolean)
        );
      } catch {
        return undefined;
      }
    };
    const [incidents, presets, dashboards, workflows] = await Promise.all([
      ids(() => this.incidents.getIncidents()),
      ids(() => this.presets.getPresets()),
      ids(() => this.dashboards.getDashboards()),
      ids(() => this.workflows.listWorkflows()),
    ]);
    return { incidents, presets, dashboards, workflows };
  }

  /**
   * Delete everything created since `baseline`: alerts seeded via
   * `alerts.sendAlert` (hard-deleted), plus any incident / preset / dashboard /
   * workflow not present in the baseline (covers both API- and UI-created
   * resources). Fully best-effort — every failure is swallowed so teardown never
   * fails a test.
   */
  async cleanupSince(baseline: ResourceSnapshot): Promise<void> {
    const purge = async (
      have: Set<string> | undefined,
      list: () => Promise<any[]>,
      delOne: (id: string) => Promise<void>
    ): Promise<void> => {
      if (!have) return; // baseline unavailable → don't risk deleting everything
      const current = await list().catch(() => [] as any[]);
      for (const r of current) {
        const id = String(r?.id ?? r?.workflow_id ?? "");
        if (id && !have.has(id)) await delOne(id).catch(() => {});
      }
    };

    await purge(baseline.incidents, () => this.incidents.getIncidents(), (id) => this.incidents.deleteIncident(id));
    await purge(baseline.presets, () => this.presets.getPresets(), (id) => this.presets.deletePreset(id));
    await purge(baseline.dashboards, () => this.dashboards.getDashboards(), (id) => this.dashboards.deleteDashboard(id));
    await purge(baseline.workflows, () => this.workflows.listWorkflows(), (id) => this.workflows.deleteWorkflow(id));

    await this.alerts.deleteCreated();
  }
}
