# Duplicate a dashboard (UI)

Users copy a dashboard from the sidebar. Hovering a dashboard in the Dashboards list
shows a gray copy icon next to the trash icon. It turns orange under the pointer and
has a "Duplicate" tooltip. Clicking it opens the "Duplicate dashboard" dialog. On
success the user lands on the copy.

The backend half is `POST /dashboard/{dashboard_id}/duplicate` in keep-api-gateway.
That repo's `docs/dashboard-duplicate.md` is the full write-up: the API contract, the
image copy, the transaction, the tests and every decision made during the build.
**Merge and deploy the gateway first.**

## Behaviour

- **Entry point.** The sidebar hover icon is the only one. Nothing is added to the
  dashboard page; duplicating is an occasional action.
- **Default name.** `<name> (copy)`, then `(copy 2)`, `(copy 3)`… Names are compared
  trimmed and case-insensitively.
- **Duplicate button.** It is disabled for a blank name, a taken name, or while
  saving. Enter submits.
- **Saved version only.** If the source is open with unsaved edits, the dialog says
  "Unsaved changes aren't included in the copy." Navigation to the copy goes through
  the existing unsaved-changes guard.
- **Errors.**
  - 409 shows "A dashboard with this name already exists" inline and refreshes the
    list, so from then on the local name check catches that name.
  - 404 shows "This dashboard no longer exists" and refreshes the list. Duplicate stays
    disabled and typing does not clear the message, because every retry would get the
    same 404.
  - Anything else shows an error toast.
- **Tooltip.** The "Duplicate" tooltip opens on hover or keyboard focus
  (`:focus-visible`). It does not open when the dialog returns focus to the button
  after a mouse-driven close. After a close with Escape or Enter it does show, because
  that focus is keyboard focus.
- **Name case on the server.** The gateway's duplicate endpoint also rejects a name
  that differs only in case, so API callers get the same rule as this dialog.
- **Cancel while saving.** If the dialog is closed while a request is in flight, a
  late success only toasts; it never navigates.

## Files

| File | Role |
|---|---|
| `src/features/dashboard-duplicate/lib/copy-name.ts` | `defaultCopyName`, `isDashboardNameTaken` |
| `src/features/dashboard-duplicate/model/useDuplicateDashboard.ts` | Calls the endpoint, appends the copy to the SWR `/dashboard` list, records the `duplicate_dashboard` metric |
| `src/features/dashboard-duplicate/ui/DuplicateDashboardModal.tsx` | The dialog |
| `src/components/LinkWithIcon.tsx` | Optional `onDuplicate`, `duplicateAriaLabel`, `duplicateDataCy`. Other links render exactly as before. |
| `src/components/navbar/DashboardLink.tsx`, `DashboardLinks.tsx` | Wire the icon. The clicked dashboard is kept as a snapshot in state. |
| `src/metrics/labels.ts` | `duplicate_dashboard` added to `ACTION_LABELS` |

## data-cy selectors

| Selector | Element |
|---|---|
| `nav-link-dashboard-duplicate-<id>` | sidebar copy button (icon-only, no text) |
| `dashboard-duplicate-modal` | dialog |
| `dashboard-duplicate-name-input` | name input |
| `dashboard-duplicate-name-error` | inline name / server error (`role="alert"`) |
| `dashboard-duplicate-unsaved-note` | "Unsaved changes aren't included" note |
| `dashboard-duplicate-cancel-btn` | Cancel |
| `dashboard-duplicate-submit-btn` | Duplicate |

`nav-link-dashboard-duplicate-<id>` shares the `nav-link-dashboard-` prefix. Prefix
locators must keep filtering by text, as the existing page object does.

These selectors are not yet in the generated [`data-cy-selectors.md`](data-cy-selectors.md).
On `dev` that inventory already fails `npm run audit:data-cy -- --check` (it was stale
before this change), so it was not regenerated here. That keeps this change free of
unrelated selectors.

## Tests

`npx jest src/features/dashboard-duplicate src/components` covers:

- the naming rules
- the hook: request, cache update and metrics
- that the hook returns while the list refetch is still running.
  `useDuplicateDashboard.swr.test.tsx` uses real SWR; in swr 2.3.8, `mutate(...,
  { revalidate: true })` starts the refetch without awaiting it.
- the dialog: copy, validation, Enter, encoding, errors, unsaved note, cancel while
  saving, accessibility
- `LinkWithIcon`: the copy button, no navigation, the tooltip's focus rule, and trash
  classes unchanged for other links
- the sidebar wiring

The full flow was also checked in a browser against a local stack.
