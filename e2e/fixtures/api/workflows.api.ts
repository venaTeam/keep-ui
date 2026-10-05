import { HttpClient } from "./http-client";

/**
 * Workflows API — reached as `api.workflows.*`. Talks to the workflows service
 * base URL (`workflowsUrl`), not the gateway.
 */
export class WorkflowsApi extends HttpClient {
  async createWorkflowFromYaml(yaml: string, filename = "barbor.yml"): Promise<any> {
    const form = new FormData();
    form.append("file", new Blob([yaml], { type: "application/yaml" }), filename);
    const res = await this.req(this.workflowsUrl, "POST", "/workflows", form);
    return this.json(res, "createWorkflowFromYaml");
  }

  async listWorkflows(): Promise<any[]> {
    const res = await this.req(this.workflowsUrl, "GET", "/workflows");
    const data = await this.json<any>(res, "listWorkflows");
    return data?.results ?? data ?? [];
  }

  deleteWorkflow(id: string): Promise<void> {
    return this.del(this.workflowsUrl, `/workflows/${encodeURIComponent(id)}`, "deleteWorkflow");
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
      this.workflowsUrl,
      "POST",
      `/workflows/${encodeURIComponent(id)}/run`,
      body ?? {}
    );
    return this.json(res, "runWorkflow");
  }

  async getExecution(executionId: string): Promise<any> {
    const res = await this.req(
      this.workflowsUrl,
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
