# Incident Table Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Incident Table" dashboard widget type. It lists incidents filtered by status (firing/acknowledged/suppressed) and severity (critical/high/warning), shows up to 7 configurable columns, and has a "Go to INC page" button.

**Architecture:** A new `WidgetType.INCIDENT_TABLE` owns one `WidgetData.incidentTable` config object. Three pieces live in `widget-types/incident-table/`:
- Pure helpers: CEL builder, Incidents-page URL builder, validation, ticket-link and plain-text extraction.
- A form that plugs into `WidgetModal`.
- A grid item that plugs into `GridItem` and fetches through the existing `useIncidents` hook.

No backend change.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tremor (`MultiSelect`, `TextInput`, `Button`), SWR via `useIncidents`, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-27-incident-table-widget-design.md` (copied in by Task 1). Executors read both.

## Global Constraints

- **Worktree and branch.**
  - Worktree: `/Users/yarin/keep-namespace/.worktrees/incident-table/keep-ui`. Branch: `feat/incident-table-widget`, cut from `origin/dev`.
  - Never commit to `dev` or `main`. Never push, open a PR or comment without the user's explicit go.
- **Comments.** No inline explanatory comments. JSDoc on exported functions and components is fine.
- **Styling.** Light-mode styles only. Dark mode is a global `invert()` filter.
- **Gates.** `npm run typecheck` and `npm run lint` must be clean, because the Next build ignores both. Lint only the changed paths. Never run repo-wide formatters.
- **Statuses** offered, in order: `firing`, `acknowledged`, `suppressed`. Labels: Firing, Acknowledged, Suppressed.
- **Severities** offered, in order: `critical`, `high`, `warning`. Labels: Critical, High, Warning. CEL and facet numbers: critical=5, high=4, warning=3.
- **Columns**, in this fixed order: `status`, `severity`, `name`, `description`, `alertsCount`, `creationTime`, `snLink`. Headers: Status, Severity, Name, Description, Alerts, Created, SN Link.
- **New-widget defaults:** all 3 statuses, all 3 severities, all 7 columns, `limit` 10. `limit` must be an integer from 1 to 50. The layout is `w: 16, h: 11, minW: 0, minH: 2, static: false` (changed from the Alert Table's w 8, h 6 after the browser proof: too small to read).
- **Exact copy:**
  - "Incident Table"
  - "Incident statuses to display"
  - "Incident severities to display"
  - "Columns"
  - "Max incidents to show"
  - "Incidents count:"
  - "showing {limit} out of {count}"
  - "Go to INC page"
  - "No incidents match these filters"
  - "Couldn't load incidents"
  - "Open"
  - "—"
  - "Select at least one status"
  - "Select at least one severity"
  - "Select at least one column"
  - "Enter a whole number from 1 to 50"
- **Refresh** every 30000 ms. Sort by `creation_time` descending.
- **Time filter.** The dashboard `time_stamp` filter is ignored, so there's no time clause anywhere.

## Review Focus

1. **Severity literal form.** If the gateway's severity facet values aren't the numbers 5/4/3, the widget silently shows zero rows. Task 1 Step 6 probes a live gateway.
2. **Description HTML.** Summaries are HTML, possibly with `<script>`, entities or nested tags. They must render as inert plain text. Task 1 covers this with `toPlainText` tests on `<p>a &amp; b</p><script>x</script>`.
3. **SN-link click.** Clicking the link must not also navigate the row. Task 3 asserts that `router.push` is not called when the link is clicked.
4. **Editing an existing widget into a different type** must drop `incidentTable`, and editing it back must start from defaults. Task 1 has the `stripForeignTypeFields` tests. Task 2 tests that the form with an `editingItem` lacking `incidentTable` emits the defaults.
5. **A saved config whose columns were picked out of order** must still render in the fixed order. Task 3 renders with `columns: ["snLink", "name", "status"]` and asserts the header order Status, Name, SN Link.

---

### Task 1: Worktree, config model and pure helpers

**Files:**
- Create: `docs/superpowers/specs/2026-10-27-incident-table-widget-design.md`, copied from `/private/tmp/claude-501/-Users-yarin-keep-namespace/6f8811fd-adfd-4ba6-92de-e2a211844171/scratchpad/2026-10-27-incident-table-widget-design.md`
- Create: `docs/superpowers/plans/2026-10-27-incident-table-widget.md` (this file)
- Modify: `src/app/(keep)/dashboard/types.tsx`
- Modify: `src/app/(keep)/dashboard/widget-type-fields.ts`
- Create: `src/app/(keep)/dashboard/widget-types/incident-table/incident-table-config.ts`
- Test: `src/app/(keep)/dashboard/widget-types/incident-table/__tests__/incident-table-config.test.ts`
- Test: `src/app/(keep)/dashboard/__tests__/widget-type-fields.test.ts` (extend)

**Interfaces:**
- Produces, in `types.tsx`:
  ```ts
  WidgetType.INCIDENT_TABLE = "INCIDENT_TABLE"
  export type IncidentTableStatus = "firing" | "acknowledged" | "suppressed";
  export type IncidentTableSeverity = "critical" | "high" | "warning";
  export type IncidentTableColumn = "status" | "severity" | "name" | "description" | "alertsCount" | "creationTime" | "snLink";
  export interface IncidentTableWidgetConfig { statuses: IncidentTableStatus[]; severities: IncidentTableSeverity[]; columns: IncidentTableColumn[]; limit: number; }
  WidgetData.incidentTable?: IncidentTableWidgetConfig
  ```
- Produces, in `incident-table-config.ts`:
  - `INCIDENT_TABLE_STATUS_OPTIONS: { value: IncidentTableStatus; label: string }[]`, in the Global Constraints order.
  - `INCIDENT_TABLE_SEVERITY_OPTIONS: { value: IncidentTableSeverity; label: string; order: number }[]`, with critical 5, high 4, warning 3.
  - `INCIDENT_TABLE_COLUMNS: { id: IncidentTableColumn; header: string }[]`, in the fixed order.
  - `INCIDENT_TABLE_LIMIT_MIN = 1`, `INCIDENT_TABLE_LIMIT_MAX = 50`.
  - `DEFAULT_INCIDENT_TABLE_CONFIG: IncidentTableWidgetConfig`.
  - `INCIDENT_TABLE_NEW_WIDGET_LAYOUT: Partial<LayoutItem>`.
  - `buildIncidentTableCel(config: IncidentTableWidgetConfig): string`
  - `buildIncidentsPageUrl(config: IncidentTableWidgetConfig): string`
  - `validateIncidentTableConfig(config: IncidentTableWidgetConfig): Partial<Record<"statuses" | "severities" | "columns" | "limit", string>>`
  - `orderIncidentTableColumns(columns: IncidentTableColumn[]): IncidentTableColumn[]`
  - `getIncidentTicketLink(incident: IncidentDto): { url: string; label: string } | null`
  - `toPlainText(html: string | null | undefined): string`
  - `describeIncidentTableFilters(config: IncidentTableWidgetConfig): string`

- [ ] **Step 1: Create the worktree and commit the spec and plan.** Use superpowers:using-git-worktrees:
  ```bash
  git -C /Users/yarin/keep-namespace/keep-ui fetch origin dev
  git -C /Users/yarin/keep-namespace/keep-ui worktree add -b feat/incident-table-widget /Users/yarin/keep-namespace/.worktrees/incident-table/keep-ui origin/dev
  ```
  Then:
  1. Clone `node_modules` into the worktree with `cp -Rc` from `/Users/yarin/keep-namespace/keep-ui/node_modules`. Don't symlink it, because Turbopack needs a real copy. Copy `.env.local` too, if it exists.
  2. Copy the spec and this plan into `docs/superpowers/`.
  3. Commit with message `docs: incident table widget spec and plan`.

- [ ] **Step 2: Write the failing tests in `incident-table-config.test.ts`.**
  ```ts
  expect(buildIncidentTableCel(DEFAULT_INCIDENT_TABLE_CONFIG)).toBe(
    "is_candidate == false && status in ['firing', 'acknowledged', 'suppressed'] && severity in [5, 4, 3]");
  expect(buildIncidentTableCel({ ...DEFAULT_INCIDENT_TABLE_CONFIG, statuses: ["suppressed"], severities: ["high"] })).toBe(
    "is_candidate == false && status in ['suppressed'] && severity in [4]");
  const url = new URL(buildIncidentsPageUrl({ ...DEFAULT_INCIDENT_TABLE_CONFIG, statuses: ["firing", "acknowledged"], severities: ["critical"] }), "http://x");
  expect(url.pathname).toBe("/incidents");
  expect(url.searchParams.get("facet_status")).toBe("'firing','acknowledged'");
  expect(url.searchParams.get("facet_severity")).toBe("5");
  expect([...url.searchParams.keys()].sort()).toEqual(["facet_severity", "facet_status"]);
  expect(validateIncidentTableConfig(DEFAULT_INCIDENT_TABLE_CONFIG)).toEqual({});
  expect(validateIncidentTableConfig({ ...DEFAULT_INCIDENT_TABLE_CONFIG, statuses: [], severities: [], columns: [], limit: 0 })).toEqual({
    statuses: "Select at least one status", severities: "Select at least one severity",
    columns: "Select at least one column", limit: "Enter a whole number from 1 to 50" });
  expect(validateIncidentTableConfig({ ...DEFAULT_INCIDENT_TABLE_CONFIG, limit: 51 }).limit).toBeDefined();
  expect(validateIncidentTableConfig({ ...DEFAULT_INCIDENT_TABLE_CONFIG, limit: 2.5 }).limit).toBeDefined();
  expect(orderIncidentTableColumns(["snLink", "name", "status"])).toEqual(["status", "name", "snLink"]);
  expect(getIncidentTicketLink(inc({ enrichments: { servicenow_ticket_url: "https://sn/1", servicenow_ticket_id: "INC001" } }))).toEqual({ url: "https://sn/1", label: "INC001" });
  expect(getIncidentTicketLink(inc({ enrichments: { servicenow_ticket_url: "https://sn/1" } }))).toEqual({ url: "https://sn/1", label: "Open" });
  expect(getIncidentTicketLink(inc({ enrichments: { ticketing_ticket_url: "https://t/2", ticketing_ticket_id: "T2" } }))).toEqual({ url: "https://t/2", label: "T2" });
  expect(getIncidentTicketLink(inc({ servicenow_ticket_url: "https://sn/top" } as any))).toEqual({ url: "https://sn/top", label: "Open" });
  expect(getIncidentTicketLink(inc({ enrichments: {} }))).toBeNull();
  expect(toPlainText("<p>a &amp; b</p><script>x</script>")).toBe("a & b");
  expect(toPlainText(null)).toBe("");
  expect(describeIncidentTableFilters({ ...DEFAULT_INCIDENT_TABLE_CONFIG, severities: ["high", "critical"] })).toBe("Firing, Acknowledged, Suppressed · Critical, High");
  ```
  Here `inc(partial)` builds a minimal `IncidentDto` cast. Then add to `widget-type-fields.test.ts`:
  - `stripForeignTypeFields(incidentWidget, WidgetType.IMAGE)` has no `incidentTable`.
  - `stripForeignTypeFields(incidentWidget, WidgetType.INCIDENT_TABLE)` keeps it.
  - `stripForeignTypeFields(presetWidget, WidgetType.INCIDENT_TABLE)` drops `preset`.

- [ ] **Step 3: Run the tests and confirm they fail.**
  Run: `npx jest "src/app/\(keep\)/dashboard/widget-types/incident-table/__tests__/incident-table-config.test.ts" "src/app/\(keep\)/dashboard/__tests__/widget-type-fields.test.ts"`
  Expected: FAIL. The config module can't be found, and `WidgetType.INCIDENT_TABLE` is undefined.

- [ ] **Step 4: Implement the types, `TYPE_FIELDS[WidgetType.INCIDENT_TABLE] = ["incidentTable"]`, and the helpers.**
  - **`buildIncidentTableCel`:**
    - Statuses are quoted with `valueToString` from `@/features/filter/store/utils` and joined with `", "`.
    - Severities map to their `order` numbers.
    - Both lists follow the option order, not the selection order.
  - **`buildIncidentsPageUrl`:** uses `URLSearchParams` with the same literals, joined with `","` (no space). That's the facet query-param form `use-query-params.ts` reads.
  - **`getIncidentTicketLink`:**
    - Checks `servicenow_ticket_url` first, then `ticketing_ticket_url`, taking the first non-empty one.
    - For each key it reads `incident.enrichments?.[key]`, then the top-level `(incident as any)[key]`.
    - The label is the paired `*_ticket_id`, or `"Open"` if there's none.
  - **`toPlainText`:** `new DOMParser().parseFromString(html, "text/html")`. Remove `script` and `style` nodes, read `body.textContent`, collapse whitespace, trim.

- [ ] **Step 5: Run the tests and confirm they pass.** Same command. Expected: PASS.

- [ ] **Step 6: Probe the severity and status literal form against a live gateway.**
  1. With a running gateway, either local noauth or `integration/incidents-behavior`, call `GET /incidents/facets/options?cel=` for the incident `severity` and `status` facets. The facet ids come from `GET /incidents/facets`.
  2. Confirm the severity option values are numbers (5/4/3) and the status values are strings.
  3. Call `GET /incidents?cel=<buildIncidentTableCel(default)>&limit=1` and confirm a 200 response with a `count`.

  If the values differ, fix the literal mapping and the Step 2 expectations before committing. If no gateway is running, record "probe pending" in the commit body; Task 4 Step 3 must then do this probe.

- [ ] **Step 7: Commit** `src/app/(keep)/dashboard/types.tsx`, `widget-type-fields.ts`, `widget-types/incident-table/incident-table-config.ts`, and both test files. Message: `feat(dashboard): incident table widget config and helpers`.

### Task 2: Widget form and modal wiring

**Files:**
- Create: `src/app/(keep)/dashboard/widget-types/incident-table/incident-table-widget-form.tsx`
- Modify: `src/app/(keep)/dashboard/WidgetModal.tsx`
- Test: `src/app/(keep)/dashboard/widget-types/incident-table/__tests__/incident-table-widget-form.test.tsx`

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces: `export function IncidentTableWidgetForm({ editingItem, onChange }: { editingItem?: WidgetData | null; onChange: (formValue: Partial<WidgetData>, isValid: boolean) => void }): JSX.Element`. It has the same contract as `GrafanaPanelWidgetForm` (`widget-types/grafana-panel/grafana-panel-widget-form.tsx`), including the `onChangeRef` pattern. Root element: `data-cy="dashboard-widget-form-incident-table"`.

- [ ] **Step 1: Write the failing tests.** Follow `grafana-panel-widget-form.test.tsx` for `lastCall`, and `columns-selection.test.tsx` for opening a Tremor `MultiSelect`.
  - `emits the defaults and the new-widget layout`: the last call is `[{ w: 16, h: 11, minW: 0, minH: 2, static: false, incidentTable: DEFAULT_INCIDENT_TABLE_CONFIG }, true]`.
  - `pre-fills from the edited widget and emits no layout`: `editingItem.incidentTable = { statuses: ["suppressed"], severities: ["critical"], columns: ["name"], limit: 5 }`. The last call is `[{ incidentTable: thatConfig }, true]`, with no `w` property.
  - `falls back to defaults when the edited widget has no incidentTable`: `editingItem` is a preset widget, and the last call's `incidentTable` equals `DEFAULT_INCIDENT_TABLE_CONFIG`.
  - `rejects an out-of-range limit`: change the input labelled "Max incidents to show" to `0`. The last call's `[1]` is `false`, and the text "Enter a whole number from 1 to 50" is visible.
  - `rejects an empty status selection`: open the statuses multiselect and untick all three options. The last call's `[1]` is `false`, and "Select at least one status" is visible.
  - `lists only the three statuses and three severities`: open each multiselect. The options are exactly `["Firing", "Acknowledged", "Suppressed"]` and `["Critical", "High", "Warning"]`.

- [ ] **Step 2: Run the tests and confirm they fail.**
  Run: `npx jest "src/app/\(keep\)/dashboard/widget-types/incident-table/__tests__/incident-table-widget-form.test.tsx"`
  Expected: FAIL, because the module can't be found.

- [ ] **Step 3: Implement `IncidentTableWidgetForm`.**
  - **Fields**, each under a Tremor `Subtitle` with the exact copy, in this order:
    - The statuses `MultiSelect` (`aria-label="Incident statuses to display"`).
    - The severities `MultiSelect`.
    - The columns `MultiSelect`, with labels from `INCIDENT_TABLE_COLUMNS`.
    - A `TextInput type="number"` for `limit` (`aria-label="Max incidents to show"`).
  - **Errors** come from `validateIncidentTableConfig` and appear through Tremor's `error`/`errorMessage` props, or a red `text-xs` line under the `MultiSelect`, since `MultiSelect` has no `errorMessage`.
  - **Emitted config:**
    - `columns` passes through `orderIncidentTableColumns`.
    - `limit` is `Number(input)`.
    - The layout is spread in only when there's no `editingItem`.

- [ ] **Step 4: Wire it into `WidgetModal.tsx`.**
  - Add `{ key: WidgetType.INCIDENT_TABLE, value: "Incident Table" }` right after the Preset entry in the type list.
  - Render `<IncidentTableWidgetForm editingItem={editingItem} onChange={(formValue, isValid) => setInnerFormState({ formValue, isValid })} />` when `widgetType === WidgetType.INCIDENT_TABLE`.

- [ ] **Step 5: Run the tests and confirm they pass.** Same command. Expected: PASS.

- [ ] **Step 6: Commit** the form, the test and `WidgetModal.tsx`. Message: `feat(dashboard): incident table widget form`.

### Task 3: Grid item (the widget on a dashboard)

**Files:**
- Create: `src/app/(keep)/dashboard/widget-types/incident-table/incident-table-grid-item.tsx`
- Modify: `src/app/(keep)/dashboard/GridItem.tsx`
- Test: `src/app/(keep)/dashboard/widget-types/incident-table/__tests__/incident-table-grid-item.test.tsx`

**Interfaces:**
- Consumes:
  - From Task 1: `buildIncidentTableCel`, `buildIncidentsPageUrl`, `orderIncidentTableColumns`, `getIncidentTicketLink`, `toPlainText`, `describeIncidentTableFilters`, `INCIDENT_TABLE_COLUMNS` and `DEFAULT_INCIDENT_TABLE_CONFIG`.
  - `useIncidents(query, options)` from `@/utils/hooks/useIncidents`, which returns `{ data: PaginatedIncidentsDto, isLoading, error }`.
  - `getIncidentName` from `@/entities/incidents/lib/utils`.
  - `SeverityBorderIcon` and `UISeverity` from `@/shared/ui`.
  - `TimeAgo` from `react-timeago`.
- Produces: `export default function IncidentTableGridItem({ item }: { item: WidgetData }): JSX.Element`. Root element: `data-cy="dashboard-widget-incident-table"`. Go button: `data-cy="dashboard-widget-incident-table-go-btn"`.

- [ ] **Step 1: Write the failing tests.**
  - **Setup:** mock `@/utils/hooks/useIncidents`, then read the router mock from `jest.setup.ts` (`next/navigation`) for `push`.
  - **Fixtures:** two incidents.
    - `i1`: firing, critical, `user_generated_name: "Payments down"`, `user_summary: "<p>5xx &amp; timeouts</p>"`, `alerts_count: 14`, `enrichments: { servicenow_ticket_url: "https://sn/1", servicenow_ticket_id: "INC001" }`.
    - `i2`: suppressed, high, `ai_generated_name: "Disk full"`, no ticket.

  The tests:
  - `queries incidents with the widget CEL, newest first, limit and 30s refresh`. `useIncidents` is called with:
    - `expect.objectContaining({ cel: buildIncidentTableCel(cfg), limit: cfg.limit, offset: 0, sorting: { id: "creation_time", desc: true } })` as the query.
    - `expect.objectContaining({ refreshInterval: 30000 })` as the options.
  - `ignores the dashboard time filter`: set the `useSearchParams` mock to return `time_stamp={"start":"2026-01-01","end":"2026-01-02"}`. The `cel` passed is still exactly `buildIncidentTableCel(cfg)`.
  - `renders headers in fixed order for out-of-order columns`: `columns: ["snLink", "name", "status"]`. The column headers read `["Status", "Name", "SN Link"]`.
  - `renders cell content`:
    - The text "Payments down", "5xx & timeouts", "14" and "Disk full" is visible.
    - The link named "INC001" has `href="https://sn/1"` and `target="_blank"`.
    - `i2`'s SN cell shows "—".
    - The status badges "Firing" and "Suppressed" are visible.
  - `shows count and showing-of line`:
    - With `{ count: 23, items: [i1, i2] }` and `limit: 2`, the text "showing 2 out of 23" is visible.
    - With `{ count: 2 }` and `limit: 10`, "Incidents count:" is followed by "2".
  - `shows the active filters`: the text "Firing, Acknowledged, Suppressed · Critical, High, Warning" is visible for the default config.
  - `Go to INC page navigates to the filtered Incidents page`: click the button, and `push` was called with `buildIncidentsPageUrl(cfg)`.
  - `row click opens the incident, SN link click does not`:
    - Click the "Payments down" text, and `push` was called with `/incidents/i1/alerts`.
    - Reset the mock, click the "INC001" link, and `push` was not called.
  - `empty, loading and error states`:
    - `{ count: 0, items: [] }` shows "No incidents match these filters".
    - `isLoading: true` renders 5 skeleton rows (`data-testid="incident-table-skeleton-row"`).
    - `error: new Error()` shows "Couldn't load incidents".

- [ ] **Step 2: Run the tests and confirm they fail.**
  Run: `npx jest "src/app/\(keep\)/dashboard/widget-types/incident-table/__tests__/incident-table-grid-item.test.tsx"`
  Expected: FAIL, because the module can't be found.

- [ ] **Step 3: Implement `IncidentTableGridItem`.**
  - **Query:** `useIncidents({ candidate: null, predicted: null, limit, offset: 0, sorting: { id: "creation_time", desc: true }, cel }, { refreshInterval: 30000, revalidateOnFocus: false })`.
  - **Config:** `item.incidentTable ?? DEFAULT_INCIDENT_TABLE_CONFIG`.
  - **Layout** mirrors `widget-types/preset/preset-alert-table-panel.tsx`:
    - The count line and the filter summary go on the left.
    - The `Button color="orange" variant="secondary" size="xs"` labelled "Go to INC page" goes on the right. It calls `router.push(buildIncidentsPageUrl(cfg))`.
  - **Table:** mirrors `widget-types/preset/widget-alerts-table.tsx`. It's a CSS grid with `text-xs` and `border-b` rows, an outer `border rounded-md overflow-x-auto` wrapper, and a `min-content` template for status, severity, alerts, created and SN link (`minmax(100px, 1fr)` for name and description).
  - **Name and description cells:** use `getIncidentName(incident)` for the name. The description is `toPlainText(user_summary || generated_summary)`. Both are one line with `truncate`, and their `title` holds the full text.
  - **Row click:** the row cells are `cursor-pointer`, and a click calls `router.push(\`/incidents/${id}/alerts\`)`.
  - **SN link:** `<a target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{label} ↗</a>`.
  - **Status badges:**
    - Firing: `bg-red-100 text-red-700`.
    - Acknowledged: `bg-blue-100 text-blue-700`.
    - Suppressed: `bg-gray-200 text-gray-600`.
  - **Severity cell:** `<SeverityBorderIcon severity={incident.severity as unknown as UISeverity} />` plus the capitalised label.
  - **Created cell:** `<TimeAgo date={creation_time} title={new Date(creation_time).toLocaleString()} />`.

- [ ] **Step 4: Wire it into `GridItem.tsx`.** Add `{item.widgetType === WidgetType.INCIDENT_TABLE && <IncidentTableGridItem item={item} />}` next to the Grafana line.

- [ ] **Step 5: Run the tests and confirm they pass.** Same command. Expected: PASS.

- [ ] **Step 6: Commit** the grid item, the test and `GridItem.tsx`. Message: `feat(dashboard): incident table widget on the dashboard`.

### Task 4: Gates and proof in the real app

**Files:** none new. Fix whatever the gates surface, in the task's own files.

- [ ] **Step 1: Run the gates.**
  Run, in the worktree:
  - `npm run typecheck`
  - `npx next lint --file` on each changed `.ts`/`.tsx` path
  - `npx jest "src/app/\(keep\)/dashboard"`

  Expected: typecheck exits 0 (or has no errors in changed files; diff against `origin/dev` if dev already fails), there are no lint errors in changed files, and all dashboard suites pass.

- [ ] **Step 2: Bring up a stack that has the suppression code.**
  - The gateway, event-handler and workflows come from `integration/incidents-behavior`, or from `dev` once gw#93, eh#60, wf#42 and ui#71 are merged.
  - The UI comes from this worktree.
  - Follow the `sanity-check` skill's deploy conventions: noauth, and migrations from `keep-migrations`.

- [ ] **Step 3: Seed and probe.**
  1. Create 4+ incidents that cover firing, acknowledged and suppressed, with critical, high and warning severities. Link a ServiceNow ticket on one of them with "Link ticket".
  2. Run the Task 1 Step 6 probe if it's still pending.

- [ ] **Step 4: Prove it in the browser.** Capture screenshots of each check below.
  1. Add an Incident Table widget with the defaults.
  2. The rows and count match the Incidents page with the same filters.
  3. Clear Suppressed and confirm suppressed rows disappear.
  4. "Go to INC page" opens `/incidents` with the Status and Severity facets pre-ticked to the widget's set, showing the same incidents.
  5. The SN link opens in a new tab, and a row click opens the incident.
  6. Setting the dashboard "Last received" range to the last hour leaves the widget unchanged.
  7. Editing the widget into an Image widget and back starts from the defaults.

- [ ] **Step 5: Commit** any fixes with message `fix(dashboard): incident table widget proof fixes`. Do not push.
