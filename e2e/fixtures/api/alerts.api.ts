import { HttpClient } from "./http-client";

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

/**
 * Alerts API — ingest, query/poll, enrich/mutate, and hard-delete. Reached as
 * `api.alerts.*`. Tracks every seeded fingerprint so the suite can clean them up
 * (`deleteCreated`, invoked by KeepApi teardown).
 */
export class AlertsApi extends HttpClient {
  /** Fingerprints seeded via `sendAlert`, for teardown cleanup. */
  private readonly createdAlerts = new Set<string>();

  // ---- ingest -------------------------------------------------------------
  async sendAlert(
    seed: AlertSeed = {}
  ): Promise<{ fingerprint: string; lastReceived: string; status: number }> {
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
    this.createdAlerts.add(fingerprint);
    return { fingerprint, lastReceived, status: res.status };
  }

  // ---- query --------------------------------------------------------------
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

  // ---- mutate -------------------------------------------------------------
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

  // ---- delete / cleanup ---------------------------------------------------
  /**
   * Hard-delete an alert via DELETE /alerts. `lastReceived` is not validated for
   * deletion (an empty string works), and `soft_delete: false` removes the alert
   * outright rather than just flagging it.
   */
  async deleteAlert(fingerprint: string): Promise<void> {
    const res = await this.req(this.gateway, "DELETE", "/alerts", {
      fingerprint,
      lastReceived: "",
      restore: false,
      soft_delete: false,
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "");
      throw new Error(`deleteAlert → HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
  }

  /** Hard-delete every alert seeded via `sendAlert` (teardown cleanup). */
  async deleteCreated(): Promise<void> {
    for (const fp of this.createdAlerts) await this.deleteAlert(fp).catch(() => {});
    this.createdAlerts.clear();
  }
}
