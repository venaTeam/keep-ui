# Alert Table widget quick actions (change status, dismiss, link to incident, bulk)

Status: for approval, 2026-11-16 (builder check done; revised after the user chose the presets page's dialogs).
Repo: keep-ui only. No backend change, no change to the presets page's dialogs.
Base: stacked on PR #110 (`feat/alert-table-widget-customization`); branch `feat/widget-quick-actions`.
Mock (clickable canvas): https://claude.ai/artifact/AvFZ42R8XTFS22bPMEjyVi. The entry points come from the option C frames (hover tray, selection strip, group checkboxes). The dialogs they open are the presets page's, as shown in frame A. The short one-click forms in the C frames are superseded.

## Intro

### The problem

A dashboard's Alert Table widget shows a preset's latest alerts, read-only. When one of them is noisy, the person watching the dashboard has to click "Go to preset", find the alert again in the full table and act from the row's ⋯ menu there. In an alert storm they do this many times over. That round-trip is the pain.

### Who it is for

People watching an operational dashboard (NOC / on-call) who need to change, dismiss or file alerts quickly, often several at once, without leaving the dashboard.

### What we are building

Entry points on the widget's rows that open the presets page's own dialogs, for one alert or several:

| Action | One alert | Several alerts | Opens (unchanged) |
|---|---|---|---|
| Change Status | ✓ | ✓ | `AlertChangeStatusModal` (status picker, "Keeping/Disposing on new alerts", note) |
| Dismiss | ✓ | ✓ | `AlertDismissModal` (Dismiss Forever / Dismiss Until, comment required, "Keeping/Disposing on new alerts") |
| Link to incident (alerts with no live incident only) | ✓ | ✓ | `AlertAssociateIncidentModal` (pick an active incident or create a new one) |

Selection works per row, per group (when the widget groups rows, from PR #110) and for all rows shown.

## Goals, non-goals, anti-goals

**Goals**
- Act on an alert without leaving the dashboard: one click on the row opens the same dialog the presets page uses, with the same rules and defaults.
- Act on many alerts at once, including a whole group such as "No incident".
- Keep the dashboard visually calm: nothing new is on screen until the user hovers or selects.
- New actions (Self-Assign, note, ticket, Run Workflow, Restore…) can be added later as one entry each, without reworking the tray, the strip or the selection.

**Non-goals (this round)**
- Any action beyond the three above. Restore of a dismissed alert, Self-Assign, notes, tickets, workflows, provider methods: later, through the registry (§ Extensibility).
- One-click actions, new forms, or changed defaults. Every action goes through the presets page's dialog, unchanged (user, 2026-11-16).
- Undo. keep-ui has no Undo today; dropped (user, 2026-11-16).
- Acting on alerts the widget does not show. There is no "select all N in this preset"; bulk actions cover the rows on screen only.
- Changing the presets page or its dialogs.
- Touch or long-press entry points. Hover and keyboard focus are the entry points (see Constraints).
- A backend change.

**Anti-goals (would make this a failure even if it works)**
- Visible new buttons or a permanent checkbox column on the dashboard at rest. Dashboards run on wall displays; the user rejected visually heavy table changes before (PR #108) and wants rare actions behind hover.
- An action silently touching alerts the user cannot see.
- The widget behaving differently from the presets page for the same action.

## Constraints

- **Stacks on PR #110.** #110 replaces the widget's hand-built grid with the shared presets-table parts (`AlertsTableHeaders`, `AlertsTableBody`, `alert-grouped-row.tsx`) and adds grouping. This feature edits the same files, so it is built on #110's branch and can merge only after #110. If #110 changes, merge it into this branch (no rebase).
- **Hover entry point.** Row buttons and checkboxes appear on mouse hover or keyboard focus. A touch-only wall display cannot act on rows; that is accepted (people act from a desk, the wall only shows).
- **Edit mode.** #110 makes the widget's table body `inert` in dashboard edit mode. No tray, no checkboxes, no strip there; entering edit mode clears any selection and closes any open dialog.
- **Permissions.** The dialogs call endpoints that need `write:alert` (status, dismiss) or `write:incident` (link). keep-ui has no helper that knows the user's scopes, so the buttons show for everyone and a refused call surfaces through the dialog's existing error handling, as on the presets page. (Users with the `noc` role cannot open dashboards at all; `middleware.ts` keeps them on `/alerts`.)
- **The widget shows only the latest N alerts** (`countOfLastAlerts`) and polls every 30 s (`usePresetAlertsCount`). Groups hold only those N rows.
- **Dismissed does not mean gone.** On dev, dismissing sets the alert's status to `suppressed` (with `dismiss_mode` / `dismissed_until`). The alert leaves the widget only if the preset's filter excludes suppressed alerts; otherwise it stays with the Suppressed icon.
- **Dismiss Until needs the watcher.** A timed dismissal ends only when keep-workflows' watcher runs (`WATCHER=true`, default false). Production runs it (user, 2026-11-16); local stacks must set it to test Dismiss Until.
- **Existing re-fire behaviour applies as is** (event handler `apply_dismiss_lifecycle`, `keep-event-handler/src/core/db/db.py`): a new resolved occurrence clears any manual status or dismissal; a new firing occurrence clears it only if it was saved with "Disposing on new alerts". The dialogs' default is "Keeping on new alerts". The widget does not change any of this.

## Approaches considered

1. **Chosen — option C's entry points (hover tray, selection strip, group checkboxes) opening the presets page's dialogs, on top of #110, driven by an action registry.** No new forms and no new rules: the dialogs, their defaults and their calls are reused as they are. The selection the shared table already has (row checkboxes; the three-state group checkbox in `alert-grouped-row.tsx`) is turned on and restyled to appear on hover. Trade-off: waits for #110 and touches two shared table files; in return group selection is nearly free, behaviour matches the presets page by construction, and new actions are one entry.
2. **Option C as first mocked — one-click Ack / Resolve and short custom forms for Dismiss and Link.** Faster per action, but introduces new forms and new defaults, so the same action would behave differently on the dashboard and on the presets page. Rejected by the user: an extra click is acceptable, divergent logic is not.
3. **Option A — the presets page's ⋯ menu in each row.** Same dialogs, but a permanent ⋯ column adds visible weight at rest and offers no group or bulk selection. Rejected in favour of C's entry points.
4. **Build on dev's hand-built widget grid.** #110 rewrites that file, so the work would be thrown away, and there is no grouping. Rejected.

## Design: what the user sees

### At rest

Exactly today's widget (as of #110). Nothing new is visible. The table gets one narrow, empty left gutter (28 px) that will hold checkboxes. The gutter never makes a widget scroll sideways: when the columns are short of room, the flexible text column (description, else name) gives up to the gutter's 28 px, below its minimum if need be, so a widget scrolls only as far as it would without the gutter.

### Hovering a row: the tray

A small floating tray appears at the right end of the hovered row, over the last cells:

```
 ! P  High CPU on db-prod-01   CPU above 95%…   2 minutes ago  [» Change Status] [⛓ Link to incident] [🔕 Dismiss]
```

- Labels and icons match the presets page's row menu ("Change Status", "Dismiss"). For linking, the presets page says "Correlate Incident" (row menu) and "Associate with incident" (bulk bar); the widget uses "Link to incident", as in the approved mock.
- Buttons show only when they apply to that alert (registry `appliesTo`): Change Status always; Link to incident only when the alert has no live incident (definition below); Dismiss unless the alert is already suppressed.
- The tray also appears when anything in the row has keyboard focus.
- A click opens the action's dialog for that one alert. While the dialog is open the row stays highlighted.
- When a dialog opened with the mouse closes, by any means, Esc included, its button loses the focus the dialog hands back, so the tray hides once the pointer leaves the row. A dialog opened from the keyboard returns focus to its button as usual. Strip buttons behave the same way.

### Selecting

- Hovering a row also fades in a checkbox in the left gutter. The header has a select-all-shown checkbox in the same gutter. Every group header row has a three-state group checkbox (none / some / all of the group's shown rows) right of the group's chevron, where the shared group row draws it, not in the gutter.
- Once anything is ticked, every row, group header and the column header show their checkboxes (selection mode), and ticked rows get a light highlight.
- Shift-click ticks or unticks the range between the last clicked row and this one, in display order (across groups).
- Ticking a group header ticks every shown row in that group, also when the group is collapsed. A group only holds what the widget shows: "INC-142 · 2 shown · 9 in incident" ticks those 2.
- Selection is kept by alert fingerprint. When a refresh removes a row from the widget, it drops out of the selection and the count updates. The selection never contains an alert that is not on screen.
- While anything is ticked, the row trays are hidden. The strip is the one place to act, so a click never leaves the user unsure whether it hits one row or all ticked ones.

### The selection strip

While anything is ticked, the widget's "Alerts count: showing N out of M · Go to preset" line is replaced, in the same spot and height, by:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 4 selected │ » Change Status   ⛓ Link to incident   🔕 Dismiss    Clear │
└──────────────────────────────────────────────────────────────────────┘
```

- An action shows when at least one ticked alert passes its `appliesTo`, and opens its dialog for the ticked alerts that pass. When some ticked alerts are left out, the button says how many go in ("Link 3 to incident", "Dismiss 2"), since the dialogs themselves do not report skipped alerts.
- Clear unticks everything. A successful dialog also clears the selection. Either way the count line comes back. Cancelling a dialog keeps the selection.
- Esc with no dialog open clears the selection. (Inside a dialog, Esc behaves as the dialog does today.)

### The dialogs

Each action opens the presets page's dialog component as is, with the same props the presets page passes:

- **Change Status** — `AlertChangeStatusModal`, `alert` = the one alert, or the array of ticked alerts (its batch mode, titled "Change Alerts Status - Alert(s) selected: N"). `presetName` = the widget's preset.
- **Dismiss** — `AlertDismissModal`, `alert` = an array of one or more alerts, `preset` = the widget's preset.
- **Link to incident** — `AlertAssociateIncidentModal`, `alerts` = the eligible alerts, `isOpen` while shown.

Every rule, default, validation, request and success or error toast is the dialog's own. The widget only adds what happens after success (below).

**"No live incident"** (my call) uses the same rule as the widget's "+ N alerts not in an incident" count line on dev (gateway `src/repositories/alerts.py`, the missing-count query): an alert counts as having an incident only if it is linked to a visible incident that is neither a candidate nor deleted. `incident_dto` on the alert lists every link, including deleted and candidate incidents, so the client must apply this rule rather than test `incident_dto.length`. #110's "No incident" group uses the raw links and can differ for alerts whose only incident was deleted; that is #110's to align, noted for its owner.

### After a dialog succeeds

- The widget passes an `onSuccess` / `handleSuccess` callback that clears the selection and refreshes, at once rather than at the next 30 s poll, the widget and everything else on the dashboard that counts alerts: other widgets on the same preset, the count-by lines, the preset counters. The dialogs already refresh the presets page's alert list and `/preset`; the widget's own query (`usePresetAlertsCount`) is separate and must be refreshed by the widget.
- The noisy-preset sound is dashboard-wide: `PresetsNoise.tsx` plays while any critical, firing, not-deleted alert exists in any noisy preset on the dashboard, including alerts beyond the widget's N rows. Changing an alert to Acknowledged takes it out of that count, so the sound stops once the last such alert is handled. Once PR #111 lands, an acknowledged row also stops blinking.
- A dismissed alert leaves the widget only if the preset hides suppressed alerts (see Constraints); otherwise it shows the Suppressed icon.

## Extensibility: the action registry

Every action is one entry in a registry; the tray, the strip and the dialog host are driven from it. Adding Self-Assign, Note, Ticket, Run Workflow or Restore later means adding one entry that wraps the dialog the presets page already has.

```ts
interface WidgetAlertAction {
  id: string;                          // "change-status" | "link-incident" | "dismiss" | later ones
  label: string;                       // tray and strip label
  icon: ElementType;
  appliesTo: (alert: AlertDto) => boolean;   // row visibility and bulk eligibility
  bulk: boolean;                       // offered in the strip
  Dialog: ComponentType<{
    alerts: AlertDto[];                // one or more, already filtered by appliesTo
    presetName: string;
    onClose: () => void;
    onSuccess: () => void;
  }>;                                  // a thin adapter over the existing presets dialog
}
```

Order in the registry is the order on screen. The three entries this round: Change Status, Link to incident, Dismiss.

## Where the code goes

- **New feature module** `src/features/alerts/alert-quick-actions/` (FSD feature layer, so the presets page could adopt it later):
  - `model/` — the registry with its three entries (each a thin adapter over the existing dialog), the "no live incident" rule, and a hook that refreshes every alerts query on the page after a success.
  - `ui/` — the row tray, the selection strip, and a dialog host that renders the open action's `Dialog`.
  - `index.ts` barrel.
- **Widget wiring** in `src/app/(keep)/dashboard/widget-types/preset/`:
  - `widget-alerts-table.tsx`: turn on row selection (rows already use `getRowId: fingerprint`), prune the selection to shown rows on every data change, clear it and close dialogs in edit mode, render the tray and the dialog host.
  - `widget-quick-action-columns.tsx` (not `use-widget-alert-columns.ts`, whose output feeds grouping, the ⚙ panel and the saved config): the chrome columns, a narrow checkbox column (id `checkbox`, so the shared group row shows its checkbox) styled to appear on hover or in selection mode, and a trailing zero-width column whose cell hosts the row tray. Group-row selection (a group checkbox ticks the group's shown rows) is a scoped TanStack table feature in the quick-actions `model/`.
  - `preset-alert-table-panel.tsx`: swap the count line for the strip while anything is selected.
- **Shared table**, leaving the presets page's behaviour unchanged:
  - `alert-grouped-row.tsx`: let the group checkbox take the widget's hover-reveal styling (a prop or class).
  - `alerts-table-body.tsx`: today one `selectable` prop turns on both the checkboxes and `react-selectable-fast` mouse drag-to-select. Split them so the widget gets checkboxes without drag-select (my call: drag-select over a dashboard competes with text selection and the dashboard's own interactions).
- **Data refresh**: after a success the widget revalidates the `/alerts/query` and `/preset` SWR key prefixes, which cover every widget's alert list, the count queries and the preset counters. `usePresetAlertsCount` is unchanged.
- **Not touched**: `src/features/alerts/alert-change-status/`, `src/features/alerts/dismiss-alert/`, `src/features/alerts/alert-associate-to-incident/`, and everything under keep-api-gateway.

## Testing

- Jest/RTL unit tests for the registry entries: `appliesTo` (including the "no live incident" rule against deleted and candidate incidents), and that each adapter passes the right props to its dialog (single alert vs array, preset name, success callback).
- Component tests for the widget: tray appears on hover/focus and hides in selection mode; header and group checkboxes (none/some/all); shift-click range across groups; selection pruned when a refreshed list drops a row; strip replaces the count line and shows "Link 3 to incident" when some ticked alerts are skipped; Cancel keeps the selection, success clears it and refreshes; Esc clears the selection; nothing actionable in edit mode.
- Guard: no diff in the three dialog folders against the base branch.
- Browser check on a local stack (noauth, keep-workflows `WATCHER=true`): change one alert's status from the tray and several from the strip; dismiss forever and until a time, in a preset that hides suppressed alerts and in one that does not; link the "No incident" group to an existing and to a new incident; with exactly one critical firing alert across the dashboard's noisy presets, acknowledging it stops the sound; the presets page's dialogs and table behave as before.
- Gates: `npm run typecheck`, `npm run lint`, the touched jest suites. The sanity suite's alert checks (change status, dismiss, incidents) must stay green.

## Decisions log

Decided by the user (2026-11-16):
- Option C's entry points over A's ⋯ menu.
- Bulk selection, kept invisible until used.
- Group selection, and Link to incident for alerts with no incident.
- This set of actions only, built so more can be added on demand.
- No Undo.
- Every action opens the presets page's dialog exactly; no one-click actions, no new forms, existing logic and defaults, no backend change.
- Production runs the keep-workflows watcher.

My calls, open to change:
- The tray and strip say "Change Status" (one button, as on the presets page) rather than separate Ack / Resolve buttons. Separate buttons would need the dialog to accept a pre-picked status, which is a change to the dialog.
- No "select all N in this preset"; bulk covers shown rows only (asked twice, no answer).
- Row trays hide while a selection exists.
- Buttons show for everyone; permission errors surface through the dialogs as today.
- Dismiss is hidden for already-suppressed alerts (Restore is a later entry).
- The strip button shows a count when some ticked alerts are left out.
- Esc clears the selection when no dialog is open.
- "No live incident" follows the count-by "not in an incident" rule.
- No drag-to-select in the widget.

## Left to the builder

- Exact tray placement and widths (it must not cover the checkbox gutter), and the narrow-widget behaviour (icons only below a width threshold is fine).
- How the refresh-everything hook finds the alert query keys (prefix matching on the SWR keys of `useLastAlerts` / count queries, or `useRevalidateMultiple`).
- How the dialog host keeps one dialog open at a time and where it mounts (inside the widget or once per dashboard).
