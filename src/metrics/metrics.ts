import { Registry, Gauge, Histogram, Counter } from "prom-client";
import { ACTION_LABELS } from "@/metrics/labels";

export const register = new Registry();

// Action latency histogram (in seconds)
export const actionLatency = new Histogram({
  name: "keep_ui_action_latency_seconds",
  help: "Latency of user actions in keep-ui",
  registers: [register],
  labelNames: ["action"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15, 30],
});

// Count of page loads.
// Counter (not Gauge): rate()/increase() must survive process restarts.
export const pageloads = new Counter({
  name: "keep_ui_page_loads_total",
  help: "Total number of page loads in keep-ui",
  registers: [register],
  labelNames: ["page"],
});

// Count of action executions
export const actionExecutions = new Gauge({
  name: "keep_ui_action_executions_total",
  help: "Total number of action executions in keep-ui",
  registers: [register],
  labelNames: ["action"],
});

// Active users gauge
export const activeUsers = new Gauge({
  name: "keep_ui_active_users",
  help: "Number of currently active keep-ui users",
  registers: [register],
});

// Count of errors by action type.
// Counter (not Gauge): error counts are monotonic and must survive restarts.
export const errors = new Counter({
  name: "keep_ui_errors_total",
  help: "Total number of errors in keep-ui",
  registers: [register],
  labelNames: ["action"],
});

// Global errors counter (uncaught JS errors + unhandled promise rejections).
// Counter (not Gauge): monotonic UX-health signal.
export const globalErrors = new Counter({
  name: "keep_ui_global_errors_total",
  help: "Total number of uncaught JS errors and unhandled promise rejections in keep-ui",
  registers: [register],
});

// Pre-initialize all action labels to 0 so the series exist before the first
// increment. Uses the shared allow-list (pruned of dead labels).
for (const action of ACTION_LABELS) {
  errors.inc({ action }, 0);
}
