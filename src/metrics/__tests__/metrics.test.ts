import { register } from "@/metrics/metrics";
import { ACTION_LABELS, PAGE_LABELS } from "@/metrics/labels";

describe("keep-ui metric definitions", () => {
  it("exposes the fixed metrics as Counters (not Gauges)", async () => {
    const output = await register.metrics();

    // These were Gauges in the RUM PR and are now true Counters so that
    // rate()/increase() survive process restarts.
    expect(output).toContain("# TYPE keep_ui_errors_total counter");
    expect(output).toContain("# TYPE keep_ui_global_errors_total counter");
  });

  it("no longer owns keep_ui_page_loads_total (moved to the gateway)", async () => {
    const output = await register.metrics();
    // Page views are forwarded to the gateway's POST /ui/page-view in Phase 2.
    expect(output).not.toContain("keep_ui_page_loads_total");
  });

  it("drops the always-zero page-load latency histogram", async () => {
    const output = await register.metrics();
    expect(output).not.toContain("keep_ui_page_load_latency_seconds");
  });

  it("pre-initializes only the pruned action labels for errors", async () => {
    const output = await register.metrics();
    // Dead labels were removed.
    expect(output).not.toContain('keep_ui_errors_total{action="create_preset"}');
    expect(output).not.toContain('keep_ui_errors_total{action="timeline_loading"}');
    // Live labels are pre-initialized to 0.
    expect(output).toContain('keep_ui_errors_total{action="change_status"} 0');
  });

  it("keeps the allow-lists in sync (no dead labels)", () => {
    expect(ACTION_LABELS).not.toContain("create_preset" as any);
    expect(ACTION_LABELS).not.toContain("timeline_loading" as any);
    expect(PAGE_LABELS).not.toContain("preset" as any);
  });
});
