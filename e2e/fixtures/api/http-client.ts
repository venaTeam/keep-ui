import { randomUUID } from "node:crypto";

/**
 * Shared HTTP + polling primitives for the per-feature API clients.
 *
 * Every feature client (AlertsApi, IncidentsApi, …) and the composing `KeepApi`
 * extend this, so they share one auth/transport implementation — the API analog
 * of the page objects' shared `components`.
 *
 * Drives the live gateway (:8080) and workflows services directly so specs can
 * SEED data and ASSERT backend truth without going through the UI. Auth: a
 * constant `x-api-key` — under AUTH_TYPE=noauth the gateway accepts any key and
 * resolves to the `keep` single tenant with admin scope. Ingest is eventually
 * consistent, so reads come with `poll`.
 */
export interface KeepApiOptions {
  gateway: string;
  workflows: string;
  apiKey: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HttpClient {
  /** Base URL of the gateway (alerts / incidents / presets / dashboards). */
  readonly gateway: string;
  /** Base URL of the workflows service. */
  readonly workflowsUrl: string;
  private readonly apiKey: string;

  constructor(opts: KeepApiOptions) {
    this.gateway = opts.gateway.replace(/\/$/, "");
    this.workflowsUrl = opts.workflows.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
  }

  // ---- transport ----------------------------------------------------------
  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { "x-api-key": this.apiKey, ...extra };
  }

  protected async req(
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
    return fetch(`${base}${path}`, {
      method,
      headers: { ...headers, ...(init.headers as Record<string, string>) },
      body:
        body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      ...init,
    });
  }

  protected async json<T = any>(res: Response, ctx: string): Promise<T> {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${ctx} → HTTP ${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  /** Best-effort DELETE that treats a missing resource (404) as already gone. */
  protected async del(base: string, path: string, ctx: string): Promise<void> {
    const res = await this.req(base, "DELETE", path);
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "");
      throw new Error(`${ctx} → HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
  }

  /** Poll `fn` until `pred` is satisfied or the deadline passes. */
  protected async poll<T>(
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

  // ---- identifiers (shared utilities) -------------------------------------
  makeFingerprint(prefix: string): string {
    return `${prefix}-${randomUUID()}`;
  }

  nowUtc(): string {
    // ISO8601 with milliseconds + Z, matching the gateway's expected format.
    return new Date().toISOString().replace(/\.\d+Z$/, ".000Z");
  }
}
