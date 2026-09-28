import { HttpClient } from "./http-client";

/** Incidents API — reached as `api.incidents.*`. */
export class IncidentsApi extends HttpClient {
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

  /** Delete an incident (soft: the backend marks status="deleted"). */
  deleteIncident(id: string): Promise<void> {
    return this.del(this.gateway, `/incidents/${encodeURIComponent(id)}`, "deleteIncident");
  }
}
