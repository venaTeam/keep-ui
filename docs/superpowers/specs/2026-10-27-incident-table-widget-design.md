# Incident Table dashboard widget: design

Date: 2026-10-27
Repo: `keep-ui` (frontend only; no gateway, event-handler, workflows or migration change)
Approved mock: reviewed in the brainstorming session (not committed)

## 1. Intent and why

Dashboards can show alerts in a table today (the Preset widget with Panel Type "Alert Table"), but they can't show **incidents**. Operators want a dashboard card listing the incidents they care about, filtered by status and severity, with the ServiceNow ticket one click away and a quick jump to the full Incidents page.

The user's request, as stated:

- A new widget type, **Incident Table**, "like the Alert Table widget but for incidents only".
- The create/edit modal offers:
  - **Incident statuses to display**: a multi-choice dropdown with Firing, Acknowledged and Suppressed.
  - **Incident severities to display**: a multi-choice dropdown with Warning, High and Critical.
  - **Columns** (configurable): incident status, incident severity, incident name, incident description, incident alerts count (how many alerts are linked to the incident), incident create time, and SN Link (the ServiceNow URL attached to an incident).
- A **"Go to INC page"** button in the widget's top-right corner that takes you to the Incidents page.
- **Suppressed must work.** The user said the incident-suppression PR set (gw#93, eh#60, ui#71, wf#42) will be merged to `dev` by 2026-10-28.

The user approved the mock, including the behaviours it marked as guesses. Those behaviours are listed in §4 as decided.

Two further answers from the user, 2026-10-27:
- **SN links come from the "Link ticket" button** on the incident page, and from nowhere else. Workflows don't write them.
- **The widget ignores the dashboard's "Last received" time filter and always shows all matching incidents.** The user first chose to respect it like the Alert Table. They reversed that after seeing the trade-off: an incident that's still firing but has had no new alert inside the range would disappear from the widget.

## 2. Goals, non-goals, anti-goals

**Goals**
- Incident Table is a first-class widget type in the Add/Edit Widget modal, alongside Preset, Metric, Image, HTML and the others.
- It shows the newest matching incidents, refreshes on its own, and links out to each incident, its ServiceNow ticket and the Incidents page.
- It works with **Suppressed** once the suppression PRs are on `dev`.

**Non-goals**
- No actions from the widget: no acknowledge, resolve, assign or dismiss. It is read-only.
- No colour thresholds. The Alert Table has them; this widget does not.
- No statuses beyond Firing, Acknowledged and Suppressed; resolved, merged and deleted incidents are not offered. No severities beyond Warning, High and Critical; Info and Low are not offered.
- No backend change. The widget config lives in the dashboard's existing `dashboard_config` JSON, like every other widget.
- No per-widget column renaming or drag-to-reorder.
- No dashboard time filter. Unlike the Alert Table, this widget ignores the dashboard's "Last received" range, just as the Metric, Image, HTML and Grafana widgets do.

**Anti-goals (a failure even if it "works")**
- The widget and the Incidents page disagree about which incidents match the same filters. The widget must filter status and severity exactly the way the Incidents page does (same CEL path), so "Go to INC page" shows the same set.
- A still-open incident is missing from the widget because of the dashboard's time range. This is why the widget ignores that range.
- Candidate (not-yet-confirmed AI) incidents show up in the widget. The Incidents page excludes them, and so must the widget.
- Editing an existing Preset, Image or other widget into an Incident Table, or the reverse, leaves the old type's config behind and renders both. `stripForeignTypeFields` must own the new fields.
- The widget leaks incidents a user isn't allowed to see. It must use the normal `/incidents` endpoint, which already applies per-user incident permissions.

## 3. Constraints and facts from the code (origin/dev, 2026-10-27)

- **Widget plumbing.** `src/app/(keep)/dashboard/`:
  - `types.tsx` holds the `WidgetType` enum and `WidgetData`.
  - `WidgetModal.tsx` holds the type dropdown and switches to a per-type form. Each form calls `onChange(formValue, isValid)`.
  - `widget-type-fields.ts` (`TYPE_FIELDS`) lists which `WidgetData` keys each type owns.
  - `GridItem.tsx` renders the card header: drag handle, title, kebab menu.
  - Each type lives under `widget-types/<type>/` as `*-widget-form.tsx` plus `*-grid-item.tsx`, with tests in `__tests__/`.
- **Visual and behavioural reference.**
  - `widget-types/preset/preset-alert-table-panel.tsx` has the count line plus the "Go to preset" button (orange, secondary, `xs`) top-right.
  - `widget-types/preset/widget-alerts-table.tsx` has the compact CSS-grid table, the skeleton rows while loading, and refreshes every 30s.
  - The new widget should look like these two.
- **Incident data.**
  - `GET /incidents` accepts `cel`, `limit`, `offset` and `sorting`, and returns `{ items, count }`. `useIncidents` (`src/utils/hooks/useIncidents.ts`) already wraps it.
  - Each item (`IncidentDto`, `src/entities/incidents/model/models.ts`) carries:
    - `status` and `severity` (a string such as `"critical"`)
    - `user_generated_name` and `ai_generated_name`
    - `user_summary` and `generated_summary`
    - `alerts_count` and `creation_time`
    - `enrichments`
  - The gateway also merges enrichments onto the top level of the DTO.
- **Default Incidents-page CEL.** `DEFAULT_INCIDENTS_CEL` is `is_candidate == false && (status in [...])`.
- **Severity encoding.** The DB stores severity as a number: critical=5, high=4, warning=3. The incidents CEL field `severity` maps to that column. The gateway's severity facet option values are strings (`"5"`, `"4"`, `"3"`), and the Incidents page renders them through `severityMapping`. Because the option values are strings, the page quotes them in both its URL (`facet_severity='5','4','3'`) and its facet CEL (`severity in ['5', '4', '3']`). The builder uses those same quoted tokens, from one shared helper, for the widget's CEL and for the Go to INC page URL. The gateway also accepts bare numbers in the CEL, but a bare numeric URL token matches no facet option and crashes the Incidents facet panel. Confirm the form against a running gateway.
- **Suppressed.**
  - On `dev` today, the incident `Status` enum is firing, resolved, acknowledged, merged, deleted.
  - ui#71 (branch `incidents-be`) replaces `Deleted` with `Suppressed = "suppressed"`.
  - gw#93 makes the CEL `status` field return `suppressed` for incidents with an active dismissal (derived via `suppressed_if_dismiss_active_sql`).
  - So `status in ['suppressed']` works only once gw#93 is deployed.
- **SN Link.**
  - "Link ticket" on the incident page (`src/app/(keep)/incidents/[id]/link-ticket-modal.tsx`) writes an incident enrichment `<providerType>_ticket_url`, plus `<providerType>_ticket_id` when an ID is given.
  - For the ServiceNow provider those keys are `servicenow_ticket_url` and `servicenow_ticket_id`.
  - With no ticketing provider selected, the generic keys are `ticketing_ticket_url` and `ticketing_ticket_id`.
  - `src/entities/incidents/lib/ticketing-utils.ts` has related helpers.
- **Incidents page filters from the URL.** The facet panel reads `facet_<property_path>` query params (`src/features/filter/store/use-query-params/use-query-params.ts`), with values comma-separated. URL params take priority over the page's saved facet state.
- **Incident route.** `/incidents/{id}` redirects to `/incidents/{id}/alerts`.
- **Dashboard time filter.**
  - The dashboard header has a single date filter named "Last received" (`DASHBOARD_FILTERS` in `[id]/dashboard.tsx`). It's stored in the URL as `time_stamp`, a JSON value `{ start, end }`.
  - `widget-types/preset/preset-grid-item.tsx` turns it into `lastReceived >= "<start>" && lastReceived <= "<end>"` and ANDs that with the preset CEL. With no `time_stamp`, there's no time clause.
  - Metric, Image, HTML and Grafana widgets ignore the filter.
- **The Incidents page's own time picker** (`useTimeframeState`, URL params `timeFrameType`, `startDate`, `endDate`, `deltaMs`) filters on `creation_time`, not on last activity (`useIncidentsTableData.tsx`).
- **Dark mode** is a global CSS `invert()` filter (`workaround-dark` class). Build for light mode only and let the filter handle dark.
- **Team conventions.**
  - No inline explanatory comments; docstrings and JSDoc are fine.
  - Run `npm run typecheck` and `npm run lint` yourself, because the Next build ignores both.
  - Never commit to or push `dev` or `main`. Work happens on a local feature branch or worktree, and nothing is pushed without the user's say-so.

## 4. Decided behaviour

### 4.1 Widget type
- A new enum value `WidgetType.INCIDENT_TABLE = "INCIDENT_TABLE"`, labelled **"Incident Table"** in the Widget Type dropdown, placed right after "Preset". It is always available, with no provider or feature-flag gate.
- The config is stored on `WidgetData` under one new key, `incidentTable`:
  ```ts
  interface IncidentTableWidgetConfig {
    statuses: ("firing" | "acknowledged" | "suppressed")[];
    severities: ("critical" | "high" | "warning")[];
    columns: IncidentTableColumn[];
    limit: number;
    externalLink?: IncidentTableExternalLink;
  }
  interface IncidentTableExternalLink {
    url: string;
    label: string;
  }
  type IncidentTableColumn =
    | "status" | "severity" | "name" | "description"
    | "alertsCount" | "creationTime" | "snLink";
  ```
  `TYPE_FIELDS[WidgetType.INCIDENT_TABLE] = ["incidentTable"]`.
  `externalLink` is optional and was added on 2026-10-28 (see §7). The default config does not carry it.

### 4.2 Create/edit modal
These fields come below the shared Widget Name and Widget Type fields, in this order:

1. **Incident statuses to display**: a multi-select with Firing, Acknowledged and Suppressed. All three are selected by default for a new widget. At least one is required.
2. **Incident severities to display**: a multi-select with Critical, High and Warning, listed in that order. All three are selected by default. At least one is required.
3. **Columns**: a multi-select over the 7 columns. All 7 are selected by default. At least one is required.
4. **Max incidents to show**: a number, default 10, min 1, max 50.

- Editing an existing widget pre-fills every field from `incidentTable`.
- The Add/Update button stays disabled while a required field is empty or out of range, and the form shows an inline error under the offending field.
- The Widget Name stays required, as it is for every type. There is no auto-fill, because there's no preset name to borrow.
- A new widget is created at w 16, h 11 (changed from the Alert Table's w 8, h 6 after the browser proof: too small to read), so the table is readable without resizing.

### 4.3 The widget on a dashboard
**Header and count line.** The card header (drag handle, title, kebab menu) is the shared `GridItem` header and is unchanged. Under it, one row holds the following.

- **Left side**, two lines:
  - Line 1: "Incidents count: **N**", where N is the total that matches the filters (the API's `count`). When N is larger than the limit, the line reads "showing *limit* out of *N*", mirroring the Alert Table's wording.
  - Line 2: a muted summary of the active filters, for example "Firing, Acknowledged, Suppressed · Critical, High".
- **Right side**: a **"Go to INC page"** button, styled like "Go to preset" (orange, secondary, `xs`).

**Table.**
- **Column order** is always the fixed order below, whatever order the user picked the columns in. Unselected columns are hidden.

  | Column | Header | Content |
  |---|---|---|
  | `status` | Status | A small coloured badge with the capitalised status: Firing (red), Acknowledged (blue), Suppressed (gray). |
  | `severity` | Severity | The existing severity colour bar (`SeverityBorderIcon`) plus the capitalised label. |
  | `name` | Name | `user_generated_name` if present, else `ai_generated_name`. One line, truncated, full text on hover. |
  | `description` | Description | `user_summary` if present, else `generated_summary`, shown as **plain text** with HTML stripped (summaries are HTML, as the Incidents page renders them). One line, truncated, full text on hover. |
  | `alertsCount` | Alerts | `alerts_count`. |
  | `creationTime` | Created | Relative time ("12 min ago"), with the absolute date and time on hover. |
  | `snLink` | SN Link | The URL saved by "Link ticket", which the user confirmed is the only source. A link that opens the ticket in a new tab. It shows `servicenow_ticket_id`, or "Open" when there's no ID, followed by ↗. If there's no `servicenow_ticket_url`, it falls back to `ticketing_ticket_url` and `ticketing_ticket_id`. If neither URL exists, it shows a muted "—". |

- **Rows** are sorted newest first (`creation_time` descending), up to `limit` of them.
- **Clicking a row** opens `/incidents/{id}/alerts` in the same tab. Clicking the SN link opens only the ticket and does not also navigate the row.
- **Refresh.** The widget refreshes every 30 seconds, matching the Alert Table.
- **Loading** shows 5 skeleton rows, like the Alert Table.
- **Empty** shows a single muted line, "No incidents match these filters", in place of the table body. The count reads 0.
- **Error** shows a muted "Couldn't load incidents" line. The rest of the dashboard is unaffected.
- The table scrolls horizontally inside the card when it's too narrow, like the Alert Table.

### 4.4 Data path
- **Fetch.** Fetch with `useIncidents` (or the same `/incidents` call):
  - `cel = is_candidate == false && status in [<statuses>] && severity in [<severities>]`, with severity literals in the form the Incidents page uses (see §3).
  - `sorting = -creation_time`
  - `limit = config.limit`
  - `offset = 0`
- **The dashboard time filter is ignored** *(user decision)*.
  - The widget never reads `time_stamp`, and the CEL has no time clause.
  - Changing the dashboard's "Last received" range doesn't change the widget's rows or count.
- **Go to INC page** navigates to `/incidents?facet_status=<statuses>&facet_severity=<severities>`, with values in the same form the Incidents page's own facet URL uses. The Incidents page then opens already filtered to the widget's set.
  - No time-range params are passed, so the Incidents page opens on its default "all time" range, matching the widget.

### 4.5 Suppressed and timing
- The widget offers Suppressed from day one, and the feature branch is cut from `dev` **after** the suppression PRs land. Until then the branch can be developed against `origin/integration/incidents-behavior` locally (that's `origin/dev` plus gw#93, eh#60, wf#42 and ui#71). The widget's own status list is a local constant, so it doesn't depend on the shared `Status` enum.
- Against a gateway without gw#93, selecting Suppressed simply matches nothing. That isn't an error.

## 5. Tests and verification
- **Unit tests (jest)**, in `widget-types/incident-table/__tests__/`:
  - Form defaults, validation and edit pre-fill.
  - CEL builder output, including severity encoding.
  - That the CEL has no time clause even when the dashboard URL carries `time_stamp`.
  - The "Go to INC page" URL builder.
  - Column rendering: the name and description fallbacks, HTML stripped from the description, the SN-link fallbacks and "—".
  - The fixed column order.
  - Row click versus SN-link click.
  - The empty, loading and error states.
  - That `stripForeignTypeFields` removes `incidentTable` when the type changes, and keeps it otherwise.
- **Gates:** `npm run typecheck` and `npm run lint` must be clean on the changed paths.
- **Manual proof** against a local stack that has the suppression PRs. All four services on `integration/incidents-behavior` is enough. Create incidents in firing, acknowledged and suppressed states with mixed severities, one of them with a linked ServiceNow ticket. Then confirm:
  - The widget's rows and count match the Incidents page.
  - After "Go to INC page", the Incidents page shows the same set.
  - Suppressed incidents appear only when Suppressed is selected.
  - Setting the dashboard "Last received" range to "last hour" leaves the widget's rows and count unchanged.

## 6. Left to the builder
- File and component names inside `widget-types/incident-table/`.
- Whether to reuse `useIncidents` directly or add a thin hook around it.
- Whether to reuse the alert table's grid markup by extracting shared pieces, or to write a small sibling component. Prefer the smaller diff.
- The exact shades of the badge colours. The hues follow the approved mock: Firing red, Acknowledged blue, Suppressed gray. This is deliberately not `getStatusColor`, which makes Acknowledged and Suppressed both gray and the badges impossible to tell apart. *(Designer's call.)*
- How the HTML in summaries gets stripped (an existing helper, if one exists).

## 7. Extra link button (added 2026-10-28)

**Purpose.** A widget can carry one fixed shortcut to somewhere outside Keep, such as a runbook or a wiki page. The user sets the URL and the button's label in the create/edit modal, per widget. It is a single link: it does not change per incident and takes no `{{ }}` templating.

**Placement.** The button sits just left of "Go to INC page" in the widget header and is blue (secondary, `xs`), like the external-link buttons on the Preset count panel and Service Now widgets, with a trailing "open in new tab" icon. That keeps it visually distinct from the orange "Go to INC page" button, which stays in the top-right corner. The full URL shows as the button's hover title.

**Behaviour.**
- Clicking opens the URL in a new tab with `noopener,noreferrer`. It does not navigate the dashboard, and it does not touch the Incidents page URL.
- Only `http://` and `https://` URLs are accepted. `javascript:`, `ftp:` and bare hosts such as `example.com` are rejected in the modal. The widget also ignores a saved link that breaks the rule, so a stale or hand-edited config can't hand a script URL to `window.open`.
- The label is at most 30 characters. The input doesn't cut typing off; going over shows an error instead.
- URL and label are trimmed. With both blank there is no link. Filling in only one is invalid, so the Add/Update button stays disabled.

**Modal.** A new section, "Extra button (optional)", comes after "Max incidents to show", with two stacked fields: the URL (placeholder `https://`) and the label. The inline errors are:

| Field | Case | Message |
|---|---|---|
| URL | empty | Enter the URL this button opens |
| URL | not an `http(s)` URL | Enter a full link starting with http:// or https:// |
| Label | empty | Enter a label for this button |
| Label | over 30 characters | Use 30 characters or fewer |

The URL and label errors are independent, so both can show at once. They only apply once either field has text.

**Storage.** The link is optional and is saved as `incidentTable.externalLink` (`{ url, label }`) in the dashboard's existing `dashboard_config` JSON. A widget without it renders as before. Clearing both fields on an edited widget removes the key. The config normalizer keeps a saved link only if it passes the same URL and label rules, trimmed, and otherwise leaves the key out.

**Scope.** Frontend only. No gateway, event-handler, workflows or migration change. `stripForeignTypeFields` is unchanged, because `incidentTable` already owns the whole config.

**Selectors.** `dashboard-widget-incident-table-link-btn` for the button, and `dashboard-widget-form-incident-table-link-url` and `dashboard-widget-form-incident-table-link-label` for the modal fields.
