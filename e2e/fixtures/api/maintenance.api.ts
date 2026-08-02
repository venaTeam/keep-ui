import { HttpClient } from "./http-client";

/** Maintenance-window rules API — reached as `api.maintenance.*`. */
export class MaintenanceApi extends HttpClient {
  /** GET /maintenance — the tenant's maintenance-window rules. */
  async getMaintenanceRules(): Promise<any[]> {
    const res = await this.req(this.gateway, "GET", "/maintenance");
    const data = await this.json<any>(res, "getMaintenanceRules");
    return data?.results ?? data ?? [];
  }

  /** POST /maintenance — create a maintenance-window rule. */
  async createMaintenanceRule(dto: Record<string, unknown>): Promise<any> {
    const res = await this.req(this.gateway, "POST", "/maintenance", dto);
    return this.json(res, "createMaintenanceRule");
  }

  deleteMaintenanceRule(id: string | number): Promise<void> {
    return this.del(
      this.gateway,
      `/maintenance/${encodeURIComponent(String(id))}`,
      "deleteMaintenanceRule"
    );
  }
}
