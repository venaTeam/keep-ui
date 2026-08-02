import { HttpClient } from "./http-client";

/** Correlation rules API — reached as `api.rules.*`. */
export class RulesApi extends HttpClient {
  /** GET /rules — the tenant's correlation rules. */
  async getRules(): Promise<any[]> {
    const res = await this.req(this.gateway, "GET", "/rules");
    const data = await this.json<any>(res, "getRules");
    return data?.results ?? data ?? [];
  }

  /**
   * POST /rules — create a correlation rule.
   *
   * Mirrors the payload the CorrelationSidebar sends (camelCase; NOT the snake_case
   * shape GET /rules returns). Only `ruleName` is required — every other field
   * defaults to the form's defaults so callers can seed a rule with one line.
   *
   * Two representations of the same query are sent: `celQuery` (plain CEL string)
   * and `sqlQuery` ({ sql, params } — the backend unpacks .sql/.params). Keep the
   * two in sync when overriding; the defaults both match `source == "test"`.
   */
  async createRule(dto: {
    ruleName: string;
    celQuery?: string;
    sqlQuery?: { sql: string; params: Record<string, unknown> };
    timeframeInSeconds?: number;
    timeUnit?: string;
    groupingCriteria?: string[];
    groupDescription?: string;
    requireApprove?: boolean;
    resolveOn?: string;
    createOn?: string;
    incidentNameTemplate?: string;
    incidentPrefix?: string;
    multiLevel?: boolean;
    multiLevelPropertyName?: string;
    threshold?: number;
    assignee?: string;
  }): Promise<any> {
    const body = {
      ruleName: dto.ruleName,
      celQuery: dto.celQuery ?? 'source == "test"',
      sqlQuery: dto.sqlQuery ?? {
        sql: "(source = :source_1)",
        params: { source_1: "test" },
      },
      timeframeInSeconds: dto.timeframeInSeconds ?? 86400,
      timeUnit: dto.timeUnit ?? "hours",
      groupingCriteria: dto.groupingCriteria ?? [],
      groupDescription: dto.groupDescription ?? "",
      requireApprove: dto.requireApprove ?? false,
      resolveOn: dto.resolveOn ?? "never",
      createOn: dto.createOn ?? "any",
      incidentNameTemplate: dto.incidentNameTemplate ?? "",
      incidentPrefix: dto.incidentPrefix ?? "",
      multiLevel: dto.multiLevel ?? false,
      multiLevelPropertyName: dto.multiLevelPropertyName ?? "",
      threshold: dto.threshold ?? 1,
      assignee: dto.assignee,
    };
    const res = await this.req(this.gateway, "POST", "/rules", body);
    return this.json(res, "createRule");
  }

  deleteRule(id: string | number): Promise<void> {
    return this.del(
      this.gateway,
      `/rules/${encodeURIComponent(String(id))}`,
      "deleteRule"
    );
  }
}
