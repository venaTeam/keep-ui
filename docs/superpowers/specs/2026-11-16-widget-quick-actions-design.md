# Alert Table widget quick actions (status, dismiss, link to incident, bulk)

Status: for approval, 2026-11-16 (builder check done). Repo: keep-ui only, no gateway change.
Base: stacked on PR #110 (`feat/alert-table-widget-customization`); branch `feat/widget-quick-actions`.
Mock (clickable canvas): https://claude.ai/artifact/AvFZ42R8XTFS22bPMEjyVi — the chosen design is option C and its frames "C · With 3 alerts selected" and "C · Grouped by incident, with Link to incident". Frame A is the rejected alternative.

## Intro

### The problem

A dashboard's Alert Table widget shows a preset's latest alerts, read-only. When one of them is noisy, the person watching the dashboard has to click "Go to preset", find the alert again in the full table and act from the row's ⋯ menu there. In an alert storm they do this many times over. That round-trip is the pain.

### Who it is for

People watching an operational dashboard (NOC / on-call) who need to quiet, close or file alerts quickly, often several at once, without leaving the dashboard.

### What we are building

Quick actions on the widget's rows, one alert at a time or several at once:

| Action | One alert | Several alerts | Asks for input |
|---|---|---|---|
| Ack (status → acknowledged) | ✓ | ✓ | no, one click |
| Resolve (status → resolved) | ✓ | ✓ | no, one click |
| Dismiss | ✓ | ✓ | short form: reason, duration |
| Link to incident (alerts with no incident only) | ✓ | ✓ | short form: pick or name an incident |

Selection works per row, per group (when the widget groups rows, from PR #110) and for all rows shown.

## Goals, non-goals, anti-goals

**Goals**
- Act on an alert from the widget in one click (Ack, Resolve) or one short form (Dismiss, Link).
- Act on many alerts at once, including a whole group such as "No incident".
- Keep the dashboard visually calm: nothing new is on screen until the user hovers or selects.
- New actions (Self-Assign, note, ticket, Run Workflow…) can be added later as one entry each, without reworking the tray, the strip or the selection.

**Non-goals (this round)**
- Any action beyond the four above. Restore of a dismissed alert, Self-Assign, notes, tickets, workflows, provider methods: later, through the registry (§ Extensibility).
- Acting on alerts the widget does not show. There is no "select all N in this preset"; bulk actions cover the rows on screen only.
- Changing the presets page. Its menu, action tray and dialogs stay as they are.
- Touch or long-press entry points. Hover and keyboard focus are the entry points (see Constraints).
- A backend change. Every call below exists on `origin/dev` of keep-api-gateway.
- Undo. keep-ui has no Undo today; dropped this round (user, 2026-11-16). If it comes back later, an exact Undo needs the gateway to say whether a status was set by hand and whether it was saved as disposable; neither is in the alert data today.

**Anti-goals (would make this a failure even if it works)**
- Visible new buttons or a permanent checkbox column on the dashboard at rest. Dashboards run on wall displays; the user rejected visually heavy table changes before (PR #108) and wants rare actions behind hover.
- An action silently touching alerts the user cannot see.

## Constraints

- **Stacks on PR #110.** #110 replaces the widget's hand-built grid with the shared presets-table parts (`AlertsTableHeaders`, `AlertsTableBody`, `alert-grouped-row.tsx`) and adds grouping. This feature edits the same files, so it is built on #110's branch and can merge only after #110. If #110 changes, merge it into this branch (no rebase).
- **Hover entry point.** Row buttons and checkboxes appear on mouse hover or keyboard focus. A touch-only wall display cannot act on rows; that is accepted (people act from a desk, the wall only shows).
- **Edit mode.** #110 makes the widget's table body `inert` in dashboard edit mode. No tray, no checkboxes, no strip there; entering edit mode clears any selection.
- **Permissions.** Status and dismiss call endpoints that need `write:alert`; linking needs `write:incident`. keep-ui has no helper that knows the user's scopes, so buttons are shown to everyone and a refused call shows the standard error toast. (Users with the `noc` role cannot open dashboards at all; `middleware.ts` keeps them on `/alerts`.)
- **The widget shows only the latest N alerts** (`countOfLastAlerts`) and polls every 30 s (`usePresetAlertsCount`). Groups hold only those N rows.
- **Timed dismissals need the watcher.** A 1 h / 4 h / 24 h dismissal ends only when keep-workflows' watcher runs (`WATCHER=true`, default false). Production runs it (confirmed by the user, 2026-11-16), so the timed chips are honest there; local stacks must set it to test them.
- **Dismissed does not mean gone.** On dev, dismissing sets the alert's status to `suppressed` (with `dismiss_mode` / `dismissed_until`). The alert leaves the widget only if the preset's filter excludes suppressed alerts; otherwise it stays with the Suppressed icon. The mock always removes it; the product must handle both.

## Approaches considered

1. **Chosen — stack on #110, shared selection + an action registry.** Turn on the selection the shared table already has (row checkboxes; the three-state group checkbox in `alert-grouped-row.tsx`), restyle it to appear on hover, add a hover tray and a selection strip, and define every action once in a registry. Trade-off: waits for #110 and touches one shared table file; in return group selection is nearly free and new actions are one entry.
2. **Build on dev's hand-built widget grid.** Independent of #110, but #110 rewrites that same file, so the work would be thrown away when #110 lands, and there is no grouping, so no "select a whole group". Rejected.
3. **Option A from the mock — reuse the presets page's ⋯ menu and its full dialogs in the widget.** Least new UI, but every action costs 3–4 clicks plus typing, which is the pain we are removing. Rejected by the user in favour of C.

Within approach 1, hard-coding the four actions was rejected because the user asked for easy expansion later.

## Design: what the user sees

All sketches follow the mock's frames C, "C · With 3 alerts selected" and "C · Grouped by incident".

### At rest

Exactly today's widget (as of #110). Nothing new is visible. The table gets one narrow, empty left gutter (about 16 px) that will hold checkboxes.

### Hovering a row: the tray

A small floating tray appears at the right end of the hovered row, over the last cells:

```
 ! P  High CPU on db-prod-01   CPU above 95%…   2 minutes ago  [‖ Ack] [✓ Resolve] [⛓ Incident] [🔕 Dismiss]
```

- Buttons show only when they apply to that alert (registry `appliesTo`): Ack only when firing; Resolve unless resolved; Incident only when the alert has no live incident (definition under § The Link to incident form); Dismiss unless already suppressed.
- The tray also appears when anything in the row has keyboard focus.
- Ack and Resolve act immediately. Incident and Dismiss open a small form anchored under the row (below).
- While a form is open its row stays highlighted and its tray stays visible.

### Selecting

- Hovering a row also fades in a checkbox in the left gutter. The header has a select-all-shown checkbox in the same gutter, and every group header row has a three-state group checkbox there (none / some / all of the group's shown rows).
- Once anything is ticked, every row, group header and the column header show their checkboxes (selection mode), and ticked rows get a light orange background.
- Shift-click ticks or unticks the range between the last clicked row and this one, in display order (across groups).
- Ticking a group header ticks every shown row in that group, also when the group is collapsed. A group only holds what the widget shows: "INC-142 · 2 shown · 9 in incident" ticks those 2.
- Selection is kept by alert fingerprint. When a refresh removes a row from the widget, it drops out of the selection and the count updates. The selection never contains an alert that is not on screen.
- While anything is ticked, the row trays are hidden. The strip is the one place to act, so a click never leaves the user unsure whether it hits one row or all ticked ones.

### The selection strip

While anything is ticked, the widget's "Alerts count: showing N out of M · Go to preset" line is replaced, in the same spot and height, by:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 4 selected │ ‖ Ack   ✓ Resolve   ⛓ Link to incident   🔕 Dismiss    Clear │
└────────────────────────────────────────────────────────────────────────┘
```

- An action shows when at least one ticked alert passes its `appliesTo`. It runs on the ticked alerts that pass; the rest are skipped. Forms say how many are skipped ("1 selected alert is already in an incident and stays where it is"). One-click actions report the count that changed ("Acknowledged 3 alerts").
- Clear unticks everything. Acting also clears the selection. Either way the count line comes back.
- Esc closes an open form; with no form open, Esc clears the selection.

### The Dismiss form

Anchored under the row (one alert) or under the strip (several):

```
Dismiss alert                      (or: Dismiss 3 alerts)
High CPU on db-prod-01             (or: first two names "and N more")
Reason *  [ e.g. known flapping, tracked in OPS-1234        ]
Hide it for   (1 hour) (4 hours*) (24 hours) (Forever)
Hidden until today at 19:42.
[ ] Bring it back if it fires again
                                   Cancel   [Dismiss]
```

- Reason is required; Dismiss stays disabled until it has text (same rule as today's dialog).
- Duration chips, default **4 hours**. "Forever" = today's "Dismiss Forever".
- "Bring it back if it fires again" is today's "Disposing on new alerts" toggle in plain words. Off by default, as today.

### The Link to incident form

Anchored under the row (one alert, shown only for alerts with no incident) or under the strip (the ticked alerts that have no incident):

```
Link 3 alerts to an incident
High CPU on db-prod-01, Disk 91% full… and 1 more
(1 selected alert is already in an incident and stays where it is.)
Active incidents  [ search…                                  ]
  INC-142 · Checkout outage        12 minutes ago · 9 alerts
  INC-139 · DB replica lag          1 hour ago · 4 alerts
  + New incident
Incident name  [ e.g. DB failover alert storm ]   (only after "+ New incident")
                                   Cancel   [Link 3 alerts]
```

- "No live incident" (my call) uses the same rule as the widget's "+ N alerts not in an incident" count line on dev (`src/repositories/alerts.py`, the missing-count query): an alert counts as having an incident only if it is linked to a visible incident that is neither a candidate nor deleted. `incident_dto` on the alert lists every link, including deleted and candidate incidents, so the client must apply this rule rather than test `incident_dto.length`. #110's "No incident" group uses the raw links and can differ for alerts whose only incident was deleted; that is #110's to align, noted for its owner.
- Lists active incidents, newest first, the same set today's "Associate alerts to incident" dialog offers, with a search box that filters by name.
- "+ New incident" asks only for a name. The full create form stays on the incidents page.
- Link is disabled until an incident is picked, or a name is typed for a new one.

### After an action

- The widget refreshes at once (not at the next 30 s poll), and so does everything else on the dashboard that counts alerts: other widgets on the same preset, the count-by lines, the preset counters.
- A toast confirms what happened, with the count, using Keep's existing toast component. Examples: "Acknowledged “High CPU on db-prod-01”", "Dismissed 3 alerts for 4 hours", "Linked 3 alerts to INC-142 · Checkout outage".
- The noisy-preset sound is dashboard-wide: `PresetsNoise.tsx` plays while any critical, firing, not-deleted alert exists in any noisy preset on the dashboard, including alerts beyond the widget's N rows. Ack takes an alert out of that count, so the sound stops once the last such alert is acknowledged. Once PR #111 lands, an acknowledged row also stops blinking.
- A dismissed alert leaves the widget only if the preset hides suppressed alerts (see Constraints); otherwise it shows the Suppressed icon.
- On a failed call: the standard error toast, then refresh, and the selection and form stay as they were so the user can retry. `/alerts/enrich`, `/alerts/batch_enrich` and `/alerts/unenrich` can answer HTTP 200 with `{"status": "failed"}`, which `ApiClient` does not treat as an error, so the response body must be checked too. `batch_enrich` saves one fingerprint at a time, so a failed batch may be partly applied; that is why the refresh is mandatory and the UI never assumes all-or-nothing.

## Behaviour of each action (the calls)

All four reuse calls the presets page already makes. Bulk uses the batch variant with the list of fingerprints; there is no CEL-based bulk.

| Action | Call | Body |
|---|---|---|
| Ack / Resolve | `POST /alerts/batch_enrich?dispose_on_new_alert=true` (one alert may use `/alerts/enrich`) | `enrichments: { status, dismiss_mode: null, dismissed_until: null }` — the same shape as today's Change Status dialog for a non-suppressed status with "Disposing on new alerts" on, no note |
| Dismiss | `POST /alerts/batch_enrich?dispose_on_new_alert=<Bring it back>` | `enrichments: { dismiss_mode: "permanent" \| "dismiss_until", dismissed_until?: <now + duration, ISO>, note: <reason> }` — the same shape as today's Dismiss dialog |
| Link to incident | `POST /incidents/{id}/alerts` | the list of fingerprints |
| Link to a new incident | create the incident the way the incidents page form does, with only `user_generated_name` filled, then link as above | |

Notes:
- **What happens when the alert fires again** (event handler `apply_dismiss_lifecycle`, `keep-event-handler/src/core/db/db.py`): a new *resolved* occurrence clears any manual status or dismissal; a new *firing* occurrence clears it only if it was saved as disposable. Ack and Resolve from the widget are saved disposable, so the next firing occurrence turns the alert back to Firing (the behaviour the user asked for, 2026-11-16). A dismissal follows its "Bring it back if it fires again" checkbox: off (the default) keeps it through firing occurrences until it expires or the alert resolves. The presets page's Change Status defaults to "Keeping on new alerts", so an Ack made there with defaults survives a re-fire; aligning the presets page is out of scope.
- Dismiss writes the reason as the alert's `note`, replacing any earlier note, exactly as today's Dismiss dialog does.
- Ack is offered on firing alerts only (my call). Taking a dismissed (suppressed) alert out of suppression is Restore, which is out of scope this round.

- Resolve can also resolve the alert's incidents (`resolve_on=all` once every alert in it is resolved, `src/routes/alerts.py`), the same as Change Status today.

## Extensibility: the action registry

Every action is one entry in a registry; the tray, the strip, the forms and the toasts are driven from it. Adding Self-Assign or Note later means adding one entry (and its form, if it needs one).

```ts
interface WidgetAlertAction {
  id: string;                         // "ack" | "resolve" | "dismiss" | "link-incident" | later ones
  label: string;                      // row tray label
  bulkLabel?: string;                 // strip label, if different ("Link to incident")
  icon: ElementType;
  appliesTo: (alert: AlertDto) => boolean;  // row visibility and bulk eligibility
  bulk: boolean;                      // offered in the strip
  Form?: ComponentType<ActionFormProps>;    // absent = one click
  run: (alerts: AlertDto[], input?: unknown) => Promise<void>;
  describe: (count: number, input?: unknown) => string;  // toast text
}
```

Order in the registry is the order on screen. The four entries this round: Ack, Resolve, Link to incident, Dismiss.

## Where the code goes

- **New feature module** `src/features/alerts/alert-quick-actions/` (FSD feature layer, so the presets page could adopt it later):
  - `model/` — the registry, the four actions' `run` logic over `useApi()`, and a hook that refreshes every alerts query on the page after an action.
  - `ui/` — the row tray, the selection strip, the Dismiss form, the Link to incident form.
  - `index.ts` barrel.
- **Widget wiring** in `src/app/(keep)/dashboard/widget-types/preset/`:
  - `widget-alerts-table.tsx`: turn on row selection (rows already use `getRowId: fingerprint`), prune the selection to shown rows on every data change, clear it in edit mode, and render the tray.
  - `use-widget-alert-columns.ts`: add a narrow widget checkbox column (id `checkbox`, so the shared group row shows its checkbox) styled to appear on hover or in selection mode, and a trailing zero-width column whose cell hosts the row tray.
  - `preset-alert-table-panel.tsx`: swap the count line for the strip while anything is selected.
- **Shared table**, leaving the presets page's behaviour unchanged:
  - `alert-grouped-row.tsx`: let the group checkbox take the widget's hover-reveal styling (a prop or class).
  - `alerts-table-body.tsx`: today one `selectable` prop turns on both the checkboxes and `react-selectable-fast` mouse drag-to-select. Split them so the widget gets checkboxes without drag-select (my call: drag-select over a dashboard competes with text selection and the dashboard's own interactions).
- **Data refresh**: `usePresetAlertsCount` currently does not return `mutate`; expose it (or revalidate its SWR key) so the widget refreshes immediately.

## Testing

- Jest/RTL unit tests for the registry entries: `appliesTo` (including the "no live incident" rule), request bodies (including `dispose_on_new_alert`), and treating an HTTP 200 `{"status": "failed"}` as a failure.
- Component tests for the widget: tray appears on hover/focus and hides in selection mode; header and group checkboxes (none/some/all); shift-click range across groups; selection pruned when a refreshed list drops a row; strip replaces the count line; Esc behaviour; nothing actionable in edit mode.
- Forms: Dismiss disabled without a reason; duration → `dismiss_mode` / `dismissed_until`; Link disabled until a pick or a name; skip note for mixed selections.
- Browser check on a local stack (noauth): with exactly one critical firing alert across the dashboard's noisy presets, Ack stops the sound; dismiss in a preset that hides suppressed alerts vs one that does not; a timed dismissal ends on time (needs keep-workflows `WATCHER=true` locally); link the "No incident" group to an existing and to a new incident; after Ack or Resolve, a new firing occurrence of the same alert turns it back to Firing, while a dismissal with the checkbox off stays dismissed.
- Gates: `npm run typecheck`, `npm run lint`, the touched jest suites. The sanity suite's alert checks (change status, dismiss, incidents) must stay green.

## Decisions log

Decided by the user:
- Option C over A (2026-11-16).
- Bulk selection, kept invisible until used.
- Group selection and Link to incident for alerts with no incident.
- This set of actions only, built so more can be added on demand.
- No Undo this round.
- Ack and Resolve return to Firing when the alert fires again; only a dismissal kept through new alerts persists.
- Production runs the keep-workflows watcher, so the timed dismiss durations stay.

My calls, open to change:
- Duration default 4 hours; "Bring it back if it fires again" as the plain-words label, off by default.
- No "select all N in this preset"; bulk covers shown rows only (asked twice, no answer).
- Row trays hide while a selection exists.
- Buttons shown to everyone; permission errors surface as the standard toast.
- "+ New incident" asks for a name only.
- Esc closes a form, then clears the selection.
- Ack offered on firing alerts only.
- "No live incident" follows the count-by "not in an incident" rule.
- No drag-to-select in the widget.
- Every failure, including an HTTP 200 `{"status": "failed"}`, shows the error toast and refreshes.

## Left to the builder

- Exact tray placement and widths (it must not cover the checkbox gutter), icon choices, and the narrow-widget behaviour (icons only below a width threshold is fine).
- How the refresh-everything hook finds the alert query keys (prefix matching on the SWR keys of `useLastAlerts` / count queries, or `useRevalidateMultiple`).
- Whether one-alert actions use `/alerts/enrich` or `batch_enrich` with a single fingerprint.
- Toast placement, matching Keep's existing toasts.
- How the search in the incident picker is implemented (client filter over the active-incident list is fine).
