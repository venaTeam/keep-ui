import { HttpClient } from "./http-client";

/** Deduplication rules API — reached as `api.deduplication.*`. */
export class DeduplicationApi extends HttpClient {
  /** GET /deduplications — the tenant's deduplication rules (returned as an array). */
  async getDeduplicationRules(): Promise<any[]> {
    const res = await this.req(this.gateway, "GET", "/deduplications");
    const data = await this.json<any>(res, "getDeduplicationRules");
    return data?.results ?? data ?? [];
  }

  deleteDeduplicationRule(id: string | number): Promise<void> {
    return this.del(
      this.gateway,
      `/deduplications/${encodeURIComponent(String(id))}`,
      "deleteDeduplicationRule"
    );
  }
}
