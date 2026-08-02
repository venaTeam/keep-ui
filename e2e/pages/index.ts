/**
 * Barrel for the E2E page objects — specs import from "../pages".
 *
 * Organised by feature:
 *   pages/<feature>/*.page.ts      — page objects for a surface
 *   pages/<feature>/modals/*.ts    — modals reachable from that surface
 *   components/*                   — pieces shared across more than one page
 */
export * from "../components/cel";

// alerts
export * from "./alerts/alerts-feed.page";
export * from "./alerts/alert-detail-sidebar";
export * from "./alerts/modals/change-status.modal";
export * from "./alerts/modals/dismiss.modal";
export * from "./alerts/modals/restore.modal";
export * from "./alerts/modals/note.modal";
export * from "./alerts/modals/assign.modal";
export * from "./alerts/modals/create-preset.modal";
export * from "./alerts/modals/preset-form.modal";

// incidents
export * from "./incidents/incidents-list.page";
export * from "./incidents/incident-detail.page";
export * from "./incidents/modals/incident-form.modal";

// dashboard
export * from "./dashboard/dashboard.page";
export * from "./dashboard/modals/add-widget.modal";

// workflows
export * from "./workflows/workflows.page";

// MW
export * from "./maintenance-window/mw.page"

// correlation
export * from "./correlation/correlation.page";
export * from "./correlation/modals/correlation-sidebar.modal";

// deduplication
export * from "./deduplication/deduplication.page";
export * from "./deduplication/modals/deduplication-sidebar.modal";
