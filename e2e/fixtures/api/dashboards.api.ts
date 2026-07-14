import { HttpClient } from "./http-client";

/** Dashboards API — reached as `api.dashboards.*`. */
export class DashboardsApi extends HttpClient {
  async createDashboard(dto: Record<string, unknown>): Promise<any> {
    const res = await this.req(this.gateway, "POST", "/dashboard", dto);
    return this.json(res, "createDashboard");
  }

  async getDashboards(): Promise<any[]> {
    const res = await this.req(this.gateway, "GET", "/dashboard");
    const data = await this.json<any>(res, "getDashboards");
    return data?.results ?? data ?? [];
  }

  deleteDashboard(id: string): Promise<void> {
    return this.del(this.gateway, `/dashboard/${encodeURIComponent(id)}`, "deleteDashboard");
  }
}
