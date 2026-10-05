import { HttpClient } from "./http-client";

/** Presets API — reached as `api.presets.*`. */
export class PresetsApi extends HttpClient {
  async createPreset(dto: Record<string, unknown>): Promise<any> {
    const res = await this.req(this.gateway, "POST", "/preset", dto);
    return this.json(res, "createPreset");
  }

  async getPresets(): Promise<any[]> {
    const res = await this.req(this.gateway, "GET", "/preset");
    const data = await this.json<any>(res, "getPresets");
    return data?.results ?? data ?? [];
  }

  deletePreset(id: string): Promise<void> {
    return this.del(this.gateway, `/preset/${encodeURIComponent(id)}`, "deletePreset");
  }
}
