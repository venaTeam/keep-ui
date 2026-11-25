# Rule and Runbook Icon Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every alert table renders `alert_rule_url` as a Grafana-logo (or generic) icon link and `runbook_url` as a book icon link, in a 44px column headed "Rule" / "Runbook".

**Architecture:** One small shared module (`alert-link-columns.ts`) holds the column ids, default labels and the Grafana matcher. A new `AlertLinkIconCell` component renders the icon. `useAlertTableCols` routes the two ids to it ahead of its existing `isHttpUrl` branch, and gives them short headers and small sizes. The dashboard widget reuses the labels through `getColumnLabel`, and sets `meta.linksDisabled` in edit mode.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, TanStack Table, Radix Tooltip (`@/shared/ui` `Tooltip`), `react-icons/md`, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-24-rule-runbook-icon-links-design.md`

## Global Constraints

- keep-ui only. No backend change, no new npm dependency.
- Only the ids `alert_rule_url` and `runbook_url` change. Every other URL column keeps the full-URL link.
- Default labels are exactly `"Rule"` and `"Runbook"`. A non-empty rename always wins.
- Tooltip copy is exactly `"Open alert rule in Grafana"`, `"Open alert rule"` and `"Open runbook"`, followed by the full URL on its own line. The anchor's `aria-label` is the action text.
- Column size for both ids: `min: 44`, `max: 120`.
- Grafana logo: `/icons/grafana-icon.png`, 16px. Book icon: `MdMenuBook`. Generic icon: `MdOpenInNew`. Icons use the existing link blue (`text-blue-600`).
- Links: `target="_blank"`, `rel="noopener noreferrer"`, and `onClick` calls `e.stopPropagation()`.
- No inline explanatory comments. Docstrings and JSDoc only.
- Commits are local only. End messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and nothing else (no session URL).
- Lint only the changed paths. Never run a repo-wide formatter.

## Review Focus

1. A path that merely contains the text "alerting" (`/alertingx/…`, `/my-alerting/…`) is not Grafana. Only an exact `alerting` path segment counts. Tested in Task 1.
2. A `javascript:` or scheme-less value in either column stays plain text, never a link. Tested in Task 2.
3. Clicking the icon in the widget must not select the row or open the sidebar. Tested in Task 3.
4. A rename to an empty string falls back to "Rule"/"Runbook", not the raw id. Tested in Tasks 2 and 3.
5. A value with surrounding whitespace (`"  https://…  "`) still becomes a link; `href` is the trimmed URL. Tested in Task 2.

---

### Task 1: Shared link-column module

**Files:**
- Create: `src/widgets/alerts-table/lib/alert-link-columns.ts`
- Test: `src/widgets/alerts-table/lib/__tests__/alert-link-columns.test.ts`

**Interfaces:**
- Produces:
  - `export type LinkIconColumnId = "alert_rule_url" | "runbook_url"`
  - `export const LINK_ICON_COLUMN_LABELS: ReadonlyMap<LinkIconColumnId, string>`, holding `alert_rule_url → "Rule"` and `runbook_url → "Runbook"`
  - `export function isLinkIconColumn(columnId: string): columnId is LinkIconColumnId`
  - `export function isGrafanaRuleUrl(url: string): boolean`

- [ ] **Step 1: Write the failing tests.** For `isGrafanaRuleUrl`, true for:
  - `https://grafana-olly.com/alerting/grafana/aef3k2pq/view?orgId=1`
  - `https://grafana-olly.com/alerting/P1809F7CD0C75ACF3/HighCPU/view`
  - `https://grafana-olly.com/alerting/list?search=HighCPU`
  - `https://grafana-olly.com/grafana/alerting/grafana/aef3k2pq/view` (sub-path)

  False for:
  - `http://prometheus.ops.internal/alerts?search=PodCrashLooping`
  - `https://x.com/alertingx/1`
  - `https://x.com/my-alerting/1`
  - `not a url`

  `isLinkIconColumn` is true for the two ids and false for `url` and `generatorURL`.
- [ ] **Step 2: Run and see them fail.** Run `npx jest src/widgets/alerts-table/lib/__tests__/alert-link-columns.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** `isGrafanaRuleUrl` parses with `new URL()` in a try/catch (false on throw) and tests `pathname.split("/").includes("alerting")`. Give each export a one-line JSDoc.
- [ ] **Step 4: Run and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(alerts-table): add link icon column ids and Grafana rule matcher`.

### Task 2: Icon cell in the shared alert table columns

**Files:**
- Create: `src/widgets/alerts-table/ui/alert-link-icon-cell.tsx`
- Modify: `src/widgets/alerts-table/lib/alert-table-column-consts.ts` (add `linkIcon: { min: 44, max: 120 }` to `ALERT_COLUMN_SIZE`)
- Modify: `src/widgets/alerts-table/lib/alert-table-utils.tsx`:
  - generated-column header at ~line 283
  - `minSize`/`maxSize` at ~line 284
  - a new branch just before `if (isHttpUrl(value))` at ~line 394
- Test: `src/widgets/alerts-table/lib/__tests__/alert-table-utils.test.tsx` (extend; reuse its one-row-table harness pattern with `meta`)

**Interfaces:**
- Consumes: Task 1 exports.
- Produces:
  - `export function AlertLinkIconCell(props: { columnId: LinkIconColumnId; url: string; disabled?: boolean }): JSX.Element`
  - Table meta key `linksDisabled?: boolean`, read as `(context.table.options.meta as any)?.linksDisabled === true`

- [ ] **Step 1: Write the failing tests** in `alert-table-utils.test.tsx`, rendering the generated cell for each id:
  - `alert_rule_url` with the Grafana URL. Expect `getByRole("link", { name: "Open alert rule in Grafana" })` with `href` equal to the URL, `target="_blank"` and `rel="noopener noreferrer"`, and an `img` whose `src` contains `grafana-icon.png`.
  - `alert_rule_url` with the Prometheus URL. Expect a link named `"Open alert rule"` and no Grafana `img`.
  - `runbook_url` with `https://wiki.ops.internal/runbooks/high-cpu-usage`. Expect a link named `"Open runbook"`.
  - `runbook_url` with `"see on-call wiki"` renders that text and no link. `"javascript:alert(1)"` renders as text with no link. `"grafana-olly.com/alerting/grafana/x/view"` (no scheme) renders as text with no link.
  - `runbook_url` with `"  https://wiki/x  "`. Expect a link whose `href` is `https://wiki/x`.
  - With `meta: { linksDisabled: true }`: an element with `aria-disabled="true"`, and `queryByRole("link")` is null.
  - `url` with `https://example.com/a` still renders the full URL text as a link (unchanged).
  - Header: the column header for `alert_rule_url` is `"Rule"` and for `runbook_url` is `"Runbook"`. With localStorage `column-rename-mapping-<preset>` set to `{ runbook_url: "RB" }` the header is `"RB"`, and set to `{ runbook_url: "" }` it is `"Runbook"`.
  - `column.columnDef.minSize === 44` and `maxSize === 120` for both ids.
- [ ] **Step 2: Run and see them fail.** Run `npx jest src/widgets/alerts-table/lib/__tests__/alert-table-utils.test.tsx`. Expected: the new cases FAIL.
- [ ] **Step 3: Implement `AlertLinkIconCell`.**
  - Wrap the icon in `Tooltip` from `@/shared/ui` with `asChild`. The content is the action text in bold, then the URL in a `break-all` mono line.
  - Enabled: an `<a>` with the Global Constraints link attributes, `aria-label`, `data-cy="alert-link-icon-<columnId>"`, and an inline-flex 24px hit area with a rounded hover background.
  - Disabled: a `<span aria-disabled="true">` with `opacity-45 cursor-not-allowed` and no `href`.
  - The Grafana logo is a plain `<img alt="" width={16} height={16}>`.
- [ ] **Step 4: Wire it into `useAlertTableCols`.**
  - Header: `getColumnDisplayName(colName, isLinkIconColumn(colName) ? LINK_ICON_COLUMN_LABELS.get(colName)! : colName, columnRenameMapping)`. Because `getColumnDisplayName` start-cases its fallback, the short labels pass through unchanged.
  - Sizes: use `ALERT_COLUMN_SIZE.linkIcon` for the two ids.
  - Cell: before `isHttpUrl`, if `isLinkIconColumn(context.column.id)` and `isHttpUrl(trimmed)` (with `trimmed = typeof value === "string" ? value.trim() : value`), return `<AlertLinkIconCell columnId=… url={trimmed} disabled={meta?.linksDisabled === true} />`.
- [ ] **Step 5: Run and see them pass.** Same command, plus `npx jest src/widgets/alerts-table`. Expected: PASS, with no regressions in that folder.
- [ ] **Step 6: Commit.** Message: `feat(alerts-table): render rule and runbook URLs as icon links`.

### Task 3: Dashboard widget labels and edit mode

**Files:**
- Modify: `src/widgets/alerts-table/lib/alert-column-options.ts` (add entries to `COLUMN_LABELS`, ~line 160)
- Modify: `src/app/(keep)/dashboard/widget-types/preset/widget-alerts-table.tsx` (`tableMeta`, ~line 389)
- Test: `src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-alerts-table.test.tsx` (extend)
- Test: `src/widgets/alerts-table/lib/__tests__/alert-column-options.test.ts` (extend)

**Interfaces:**
- Consumes: `LINK_ICON_COLUMN_LABELS` (Task 1), `meta.linksDisabled` (Task 2).

- [ ] **Step 1: Write the failing tests.**
  - `getColumnLabel("alert_rule_url") === "Rule"`, `getColumnLabel("runbook_url") === "Runbook"`, `getColumnLabel("runbook_url", { runbook_url: "" }) === "Runbook"`, `getColumnLabel("runbook_url", { runbook_url: "RB" }) === "RB"`.
  - In `widget-alerts-table.test.tsx`, follow its existing harness, with an alert carrying a Grafana `alert_rule_url` and both columns visible:
    - not in edit mode: a link named "Open alert rule in Grafana" exists, its header reads "Rule", and clicking it does not call the row-click / selection handler the harness exposes;
    - with `isEditMode` true: no link role, and an `aria-disabled="true"` element is present.
- [ ] **Step 2: Run and see them fail.** Run `npx jest src/widgets/alerts-table/lib/__tests__/alert-column-options.test.ts "src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-alerts-table.test.tsx"`. Expected: the new cases FAIL.
- [ ] **Step 3: Implement.**
  - Build `COLUMN_LABELS` from `[["name", "Alert name"], ...LINK_ICON_COLUMN_LABELS]`.
  - `tableMeta` becomes `{ columnTimeFormats, columnListFormats, linksDisabled: isEditMode }`, with `isEditMode` added to its deps.
- [ ] **Step 4: Run and see them pass.** Same command, plus `npx jest "src/app/(keep)/dashboard/widget-types/preset"`. Expected: PASS. If a label assertion elsewhere in that folder breaks because it expected "Alert Rule Url" or "Runbook Url", update that assertion to the new label.
- [ ] **Step 5: Commit.** Message: `feat(dashboard): rule and runbook icon links in the Alert Table widget`.

### Task 4: Verification

- [ ] `npm run typecheck`: no new errors compared with origin/dev (compare the error counts if dev is not clean).
- [ ] `npx eslint` on each changed `.ts`/`.tsx` file: clean.
- [ ] `npx jest src/widgets/alerts-table "src/app/(keep)/dashboard" src/app/\(keep\)/alerts src/features/alerts`: PASS.
- [ ] Browser check, light and dark mode, on the presets page and a dashboard Alert Table widget, with alerts that carry a Grafana rule URL, a Prometheus rule URL, a runbook URL, a text runbook and empty values:
  - icons render and the columns are narrow;
  - tooltips show on hover and on keyboard focus;
  - a click opens a new tab and not the sidebar;
  - edit mode dims the icons.
