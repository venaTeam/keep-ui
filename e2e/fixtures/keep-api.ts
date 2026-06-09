/**
 * KeepApi — thin REST client for the sanity-check E2E suite.
 *
 * Drives the live gateway (:8080) and workflows (:8081) services directly so
 * specs can SEED data and ASSERT backend truth without going through the UI.
 * Auth: a constant `x-api-key` — in AUTH_TYPE=noauth the gateway accepts any
 * key and resolves to the `keep` single tenant with admin scope
 * (keep-api-gateway/.../noauth/noauth_authverifier.py).
 *
 * Everything ingest-related is eventually consistent, so reads come with poll
 * helpers (modeled on keep-namespace/keep-sre/verifier.py).
 */
import { randomUUID } from "node:crypto";

export interface KeepApiOptions {
  gateway: string;
  workflows: string;
  apiKey: string;
}

export interface AlertSeed {
  name?: string;
  status?: string;
  severity?: string;
  source?: string[];
  fingerprint?: string;
  lastReceived?: string;
  [k: string]: unknown;
}

export type DismissMode = "permanent" | "dismiss_until";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class KeepApi {
  readonly gateway: string;
  readonly workflows: string;
  private readonly apiKey: string;

  constructor(opts: KeepApiOptions) {
    this.gateway = opts.gateway.replace(/\/$/, "");
    this.workflows = opts.workflows.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
  }

  // ---- low-level ----------------------------------------------------------
  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { "x-api-key": this.apiKey, ...extra };
  }

  private async req(
    base: string,
    method: string,
    path: string,
    body?: unknown,
    init: RequestInit = {}
  ): Promise<Response> {
    const isForm = body instanceof FormData;
    const headers = this.headers(
      isForm || body === undefined ? {} : { "Content-Type": "application/json" }
    );
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { ...headers, ...(init.headers as Record<string, string>) },
      body:
        body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      ...init,
    });
    return res;
  }

  private async json<T = any>(res: Response, ctx: string): Promise<T> {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${ctx} → HTTP ${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  /** Poll `fn` until `pred` is satisfied or the deadline passes. */
  private async poll<T>(
    fn: () => Promise<T>,
    pred: (v: T) => boolean,
    { timeoutMs = 30_000, intervalMs = 2_000, what = "condition" } = {}
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let last: T | undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      last = await fn().catch(() => undefined as unknown as T);
      if (last !== undefined && pred(last)) return last;
      if (Date.now() >= deadline) {
        throw new Error(`Timed out after ${timeoutMs}ms waiting for ${what}`);
      }
      await sleep(intervalMs);
    }
  }

  // ---- identifiers --------------------------------------------------------
  makeFingerprint(prefix: string): string {
    return `${prefix}-${randomUUID()}`;
  }

  nowUtc(): string {
    // ISO8601 with milliseconds + Z, matching the gateway's expected format.
    return new Date().toISOString().replace(/\.\d+Z$/, ".000Z");
  }

  // ---- alerts: ingest -----------------------------------------------------
  async sendAlert(seed: AlertSeed = {}): Promise<{ fingerprint: string; lastReceived: string }> {
    const fingerprint = seed.fingerprint ?? this.makeFingerprint(seed.name ?? "sanity");
    const lastReceived = seed.lastReceived ?? this.nowUtc();
    const payload: Record<string, unknown> = {
      name: seed.name ?? fingerprint,
      status: seed.status ?? "firing",
      severity: seed.severity ?? "critical",
      source: seed.source ?? ["sanity-check"],
      lastReceived,
      fingerprint,
      ...seed,
    };
    const res = await this.req(this.gateway, "POST", "/alerts/event", payload);
    if (res.status !== 202 && !res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`sendAlert → HTTP ${res.status}: ${text.slice(0, 500)}`);
    }
    return { fingerprint, lastReceived };
  }

  // ---- alerts: query ------------------------------------------------------
  async getAlert(fingerprint: string): Promise<any | null> {
    const res = await this.req(this.gateway, "GET", `/alerts/${encodeURIComponent(fingerprint)}`);
    if (res.status === 404) return null;
    const data = await this.json<any>(res, "getAlert");
    // some builds return a list for the fingerprint route — normalize to one
    return Array.isArray(data) ? data[0] ?? null : data;
  }

  async queryAlerts(cel: string, limit = 100, offset = 0): Promise<any[]> {
    const res = await this.req(this.gateway, "POST", "/alerts/query", { cel, limit, offset });
    const data = await this.json<any>(res, "queryAlerts");
    return data?.results ?? data ?? [];
  }

  waitForAlert(fingerprint: string, timeoutMs = 30_000): Promise<any> {
    return this.poll(() => this.getAlert(fingerprint), (a) => a != null, {
      timeoutMs,
      what: `alert ${fingerprint} to appear`,
    });
  }

  waitForAlertField(
    fingerprint: string,
    field: string,
    expected: unknown,
    timeoutMs = 30_000
  ): Promise<any> {
    return this.poll(
      () => this.getAlert(fingerprint),
      (a) => a != null && a[field] === expected,
      { timeoutMs, what: `alert ${fingerprint}.${field} === ${JSON.stringify(expected)}` }
    );
  }

  waitForEnrichment(
    fingerprint: string,
    predicate: (alert: any) => boolean,
    timeoutMs = 30_000,
    what = "enrichment"
  ): Promise<any> {
    return this.poll(() => this.getAlert(fingerprint), (a) => a != null && predicate(a), {
      timeoutMs,
      what: `alert ${fingerprint} ${what}`,
    });
  }

  // ---- alerts: mutate -----------------------------------------------------
  async enrich(fingerprint: string, enrichments: Record<string, unknown>): Promise<void> {
    const res = await this.req(this.gateway, "POST", "/alerts/enrich", { fingerprint, enrichments });
    await this.json(res, "enrich");
  }

  changeStatus(fingerprint: string, status: string): Promise<void> {
    return this.enrich(fingerprint, { status });
  }

  async addNote(fingerprint: string, note: string): Promise<void> {
    const res = await this.req(this.gateway, "POST", "/alerts/enrich/note", { fingerprint, note });
    await this.json(res, "addNote");
  }

  async assign(fingerprint: string, lastReceived: string, note?: string): Promise<void> {
    const res = await this.req(
      this.gateway,
      "POST",
      `/alerts/${encodeURIComponent(fingerprint)}/assign/${encodeURIComponent(lastReceived)}`,
      note ? { note } : {}
    );
    await this.json(res, "assign");
  }

  async batchEnrich(args: {
    fingerprints?: string[];
    cel?: string;
    enrichments: Record<string, unknown>;
  }): Promise<void> {
    const res = await this.req(this.gateway, "POST", "/alerts/batch_enrich", args);
    await this.json(res, "batchEnrich");
  }

  dismiss(fingerprint: string, mode: DismissMode, until?: string): Promise<void> {
    const enrichments: Record<string, unknown> =
      mode === "permanent"
        ? { status: "suppressed", dismiss_mode: "permanent", dismissed: true }
        : {
            status: "suppressed",
            dismiss_mode: "dismiss_until",
            dismissed_until: until ?? new Date(Date.now() + 3_600_000).toISOString(),
          };
    return this.enrich(fingerprint, enrichments);
  }

  async getHistory(fingerprint: string): Promise<{ occurrences: any[]; activity: any[] }> {
    const res = await this.req(
      this.gateway,
      "GET",
      `/alerts/${encodeURIComponent(fingerprint)}/history`
    );
    const data = await this.json<any>(res, "getHistory");
    return { occurrences: data?.occurrences ?? [], activity: data?.activity ?? [] };
  }

  // ---- incidents / presets / dashboards -----------------------------------
  async createIncident(dto: Record<string, unknown>): Promise<any> {
    const res = await this.req(this.gateway, "POST", "/incidents", dto);
    return this.json(res, "createIncident");
  }

  async addAlertsToIncident(incidentId: string, fingerprints: string[]): Promise<void> {
    const res = await this.req(
      this.gateway,
      "POST",
      `/incidents/${encodeURIComponent(incidentId)}/alerts`,
      fingerprints // raw JSON array body
    );
    await this.json(res, "addAlertsToIncident");
  }

  async getIncidents(): Promise<any[]> {
    // /incidents is paginated (default limit 25). Request a high limit so freshly
    // seeded incidents aren't missed on a stack that has accumulated many.
    const res = await this.req(this.gateway, "GET", "/incidents?limit=1000");
    const data = await this.json<any>(res, "getIncidents");
    return data?.items ?? data?.results ?? data ?? [];
  }

  async createPreset(dto: Record<string, unknown>): Promise<any> {
    const res = await this.req(this.gateway, "POST", "/preset", dto);
    return this.json(res, "createPreset");
  }

  async getPresets(): Promise<any[]> {
    const res = await this.req(this.gateway, "GET", "/preset");
    const data = await this.json<any>(res, "getPresets");
    return data?.results ?? data ?? [];
  }

  async createDashboard(dto: Record<string, unknown>): Promise<any> {
    const res = await this.req(this.gateway, "POST", "/dashboard", dto);
    return this.json(res, "createDashboard");
  }

  async getDashboards(): Promise<any[]> {
    const res = await this.req(this.gateway, "GET", "/dashboard");
    const data = await this.json<any>(res, "getDashboards");
    return data?.results ?? data ?? [];
  }

  // ---- workflows (:8081) --------------------------------------------------
  async createWorkflowFromYaml(yaml: string, filename = "barbor.yml"): Promise<any> {
    const form = new FormData();
    form.append("file", new Blob([yaml], { type: "application/yaml" }), filename);
    const res = await this.req(this.workflows, "POST", "/workflows", form);
    return this.json(res, "createWorkflowFromYaml");
  }

  async listWorkflows(): Promise<any[]> {
    const res = await this.req(this.workflows, "GET", "/workflows");
    const data = await this.json<any>(res, "listWorkflows");
    return data?.results ?? data ?? [];
  }

  async deleteWorkflow(id: string): Promise<void> {
    const res = await this.req(this.workflows, "DELETE", `/workflows/${encodeURIComponent(id)}`);
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "");
      throw new Error(`deleteWorkflow → HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
  }

  /** Remove any existing workflow with this name (guards the fixed-id collision). */
  async deleteWorkflowByName(name: string): Promise<number> {
    const all = await this.listWorkflows().catch(() => [] as any[]);
    const matches = all.filter((w) => (w?.name ?? w?.workflow?.name) === name);
    for (const w of matches) await this.deleteWorkflow(w.id ?? w.workflow_id);
    return matches.length;
  }

  async runWorkflow(id: string, body?: Record<string, unknown>): Promise<any> {
    const res = await this.req(
      this.workflows,
      "POST",
      `/workflows/${encodeURIComponent(id)}/run`,
      body ?? {}
    );
    return this.json(res, "runWorkflow");
  }

  async getExecution(executionId: string): Promise<any> {
    const res = await this.req(
      this.workflows,
      "GET",
      `/workflows/runs/${encodeURIComponent(executionId)}`
    );
    return this.json(res, "getExecution");
  }

  waitForExecution(executionId: string, timeoutMs = 60_000): Promise<any> {
    const terminal = new Set(["success", "error", "failed", "providers_not_configured"]);
    return this.poll(
      () => this.getExecution(executionId),
      (e) => e != null && terminal.has(String(e.status ?? e.workflow_status ?? "").toLowerCase()),
      { timeoutMs, what: `workflow execution ${executionId} to finish` }
    );
  }
}
