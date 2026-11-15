# Alert Table Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render alert severity, status and "rings now" noise as words in the dashboard Alert Table widget and the presets-page table, from one shared file.

**Architecture:** A new presentational module `src/widgets/alerts-table/lib/status-severity-cells.tsx` exports `isAlertRingingNow`, `AlertSeverityBadge` and `AlertStatusPill`. `WidgetAlertsTable` (fed `presetNoisy` by `PresetAlertTablePanel`) and `useAlertTableCols` render them in the existing `severity` / `status` columns. The `noise` column is removed.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind, TanStack Table v8, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-alert-table-readability-design.md`

## Global Constraints

- keep-ui only. No API, schema, config or env change.
- No `dark:` classes. Light Tailwind colors only (dark mode is the global invert filter).
- No inline explanatory comments. JSDoc/docstrings only.
- `SeverityBorderIcon`, `TableSeverityCell`, `getStatusIcon`, `getStatusColor` and `severity-utils.ts` keep their current behavior.
- Column ids `severity` and `status` are unchanged.
- Noisy rule, verbatim: `presetNoisy && status === "firing" && severity === "critical" && !deleted`, with status lower-cased and severity normalized through `severityMapping` for numbers.
- Gates: `npx jest <touched tests>`, `npm run typecheck`, `npx eslint <changed files>`.

## Review Focus

1. Numeric severity (`5`, `"5"`) must count as critical for both the badge word and the Noisy rule. Pinned in Task 1.
2. Mixed-case status (`"FIRING"`) must render "Firing" and count as firing. Pinned in Task 1.
3. An `isNoisy: true` alert in a non-noisy preset must show no Noisy segment. This is the old widget behavior being removed. Pinned in Tasks 1 and 2.
4. With `NOISY_ALERTS_ENABLED` on, the in-browser table (`alert-table.tsx`) must not try to sort by the removed `noise` column. Its sort was already a no-op, but TanStack logs a missing-column error. Pinned in Task 3 by removing that default sort.
5. Pinned left offsets: `severity` and `status` must report `getSize()` equal to their fixed CSS width (96 / 160), or sticky pinned columns overlap. Pinned in Task 3 by asserting `size`, `minSize` and `maxSize` on the column defs.

---

### Task 1: Shared cells and the "rings now" rule

**Files:**
- Create: `src/widgets/alerts-table/lib/status-severity-cells.tsx`
- Test: `src/widgets/alerts-table/lib/__tests__/status-severity-cells.test.tsx`

**Interfaces:**
- Produces:
  - `normalizeSeverity(severity: unknown): string | undefined`. Numbers and numeric strings go through `severityMapping`; strings are lower-cased; empty values give `undefined`.
  - `isAlertRingingNow(alert: { status?: string; severity?: unknown; deleted?: boolean }, presetNoisy: boolean): boolean`
  - `AlertSeverityBadge({ severity, size = "xs" }: { severity: unknown; size?: "xs" | "sm" }): JSX.Element | null`, with `data-testid="alert-severity-badge"`
  - `AlertStatusPill({ status, noisy = false, size = "xs" }: { status?: string; noisy?: boolean; size?: "xs" | "sm" }): JSX.Element | null`, with `data-testid="alert-status-pill"`; the Noisy segment has `data-testid="alert-noisy-segment"`

- [ ] **Step 1: Write the failing tests**
  - `isAlertRingingNow` returns true for `{status:"firing", severity:"critical", deleted:false}` with `presetNoisy=true`. It returns false when any one condition flips: `presetNoisy=false`; status `"acknowledged"`; severity `"high"`; `deleted:true`. It returns true for severity `5` and `"5"` and for status `"FIRING"`. It returns false for `{status:"firing", severity:"high", isNoisy:true}` with `presetNoisy=false`.
  - `AlertSeverityBadge` renders `Critical`, `High`, `Warning`, `Low`, `Info` and `Error` for each value. `5` renders `Critical`. `"p1-custom"` renders `P1-custom` with class `bg-gray-100`. `undefined` and `""` render nothing.
  - `AlertStatusPill` renders `Firing`, `Acknowledged`, `Resolved`, `Suppressed` and `Pending`. `"merged"` renders `Merged`. The `svg` inside has `aria-hidden="true"`. `alert-noisy-segment` with text `Noisy` is present only when `noisy`. `status={undefined}` renders nothing.

- [ ] **Step 2: Run the tests and confirm they fail**
  Run: `npx jest src/widgets/alerts-table/lib/__tests__/status-severity-cells.test.tsx`
  Expected: FAIL, cannot find module `../status-severity-cells`.

- [ ] **Step 3: Implement the module**
  - Severity classes, a literal map so Tailwind keeps the classes:
    - critical: `bg-red-500` / `bg-red-100` / `text-red-800`
    - high and error: orange
    - warning: `bg-yellow-500` / `bg-yellow-100` / `text-yellow-800`
    - low: emerald
    - info: blue
    - unknown: `bg-gray-400` / `bg-gray-100` / `text-gray-800`
  - Badge: `inline-flex items-center gap-1.5 rounded font-semibold whitespace-nowrap` plus tint and ink, then a square `rounded-sm` of the base color, then `capitalize(value)`.
  - `xs` is `h-5 px-1.5 text-[11px]`, square 1.5; `sm` is `h-[22px] px-2 text-xs`, square 2.
  - Status icon: `getStatusIcon(status)` with no `isNoisy` argument.
  - Status icon color, a literal map from `getStatusColor`: red → `text-red-600`, green → `text-green-600`, purple → `text-purple-600`, anything else → `text-gray-600`.
  - Pill: `inline-flex items-stretch rounded-full border border-gray-300 bg-white overflow-hidden whitespace-nowrap`. Inner span: icon `aria-hidden`, then `text-gray-800 font-medium` word.
  - Noisy segment: `bg-gray-900 text-white font-semibold` with `BellAlertIcon` from `@heroicons/react/24/outline` (aria-hidden) and the word `Noisy`.
  - `capitalize` comes from `@/utils/helpers`, `severityMapping` from `@/entities/alerts/model`.
  - JSDoc on `isAlertRingingNow` names `NOISE_BASE_CEL` in `src/features/presets/custom-preset-links/ui/PresetsNoise.tsx` as the rule it mirrors.

- [ ] **Step 4: Run the tests and confirm they pass**
  Run: the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**
  `git add src/widgets/alerts-table/lib/status-severity-cells.tsx src/widgets/alerts-table/lib/__tests__/status-severity-cells.test.tsx && git commit -m "feat(alerts-table): shared severity badge, status pill and rings-now rule"`

### Task 2: Dashboard Alert Table widget

**Files:**
- Modify: `src/app/(keep)/dashboard/widget-types/preset/widget-alerts-table.tsx` (`columnsMeta.severity` and `columnsMeta.status`, props)
- Modify: `src/app/(keep)/dashboard/widget-types/preset/preset-alert-table-panel.tsx` (the `<WidgetAlertsTable` element)
- Test: `src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-alerts-table.test.tsx`

**Interfaces:**
- Consumes: Task 1's `AlertSeverityBadge`, `AlertStatusPill`, `isAlertRingingNow`.
- Produces: an optional `presetNoisy?: boolean` prop on `WidgetAlertsTable`, defaulting to `false`.

- [ ] **Step 1: Write the failing tests** (append to the existing describe block)
  - `"renders severity and status as words with headers"`: alerts `[{severity:"critical", status:"firing", name:"a"}, {severity:5, status:"resolved", name:"b"}]`, columns `["severity","status","name"]`. Expect header texts `Severity` and `Status`, two `Critical`, one `Firing`, one `Resolved`.
  - `"shows Noisy only on firing critical rows of a noisy preset"`: alerts critical firing, high firing, and critical acknowledged (plus `isNoisy:true` on the high one). With `presetNoisy`, exactly one `alert-noisy-segment` appears. Without `presetNoisy`, zero.

- [ ] **Step 2: Run the tests and confirm they fail**
  Run: `npx jest "src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-alerts-table.test.tsx"`
  Expected: the two new tests FAIL; the existing test passes.

- [ ] **Step 3: Implement**
  - In `columnsMeta`, `severity` and `status` keep `gridColumnTemplate: "min-content"` and drop `renderHeader`, so the default header (rename mapping or `startCase`) renders.
  - `renderValue` returns `<AlertSeverityBadge severity={alert.severity} size="xs" />` and `<AlertStatusPill status={alert.status} noisy={isAlertRingingNow(alert, presetNoisy)} size="xs" />`.
  - Add `presetNoisy` to the `columnsMeta` memo deps.
  - Remove the imports this leaves unused.
  - In `PresetAlertTablePanel`, pass `presetNoisy={!!preset?.is_noisy}`.

- [ ] **Step 4: Run the tests and confirm they pass**
  Run: the Step 2 command, plus `npx jest "src/app/(keep)/dashboard/widget-types/preset/__tests__/preset-alert-table-panel.test.tsx"`. Expected: PASS.

- [ ] **Step 5: Commit**
  `git commit -am "feat(dashboard): alert table widget shows severity, status and noisy as text"`

### Task 3: Presets-page table columns

**Files:**
- Modify: `src/widgets/alerts-table/lib/alert-table-utils.tsx` (`severity`, `noise` and `status` column defs, the `DEFAULT_COLS` `"noise"` entry, the noisy imports, `noisyAlertsEnabled`/`useConfig` if now unused, memo deps)
- Modify: `src/widgets/alerts-table/ui/alert-table-headers.tsx` (`dragStyle` status width `36px` → `160px`)
- Modify: `src/widgets/alerts-table/ui/alert-table-server-side.tsx` (`leftPinnedColumns`: drop `"noise"`; keep the `noise` default sort)
- Modify: `src/widgets/alerts-table/ui/alert-table.tsx` (`leftPinnedColumns`: drop `"noise"`; initial `sorting` becomes `[]`; drop `useConfig`/`noisyAlertsEnabled` if now unused)
- Test: `src/widgets/alerts-table/lib/__tests__/alert-table-cols.test.tsx`

**Interfaces:**
- Consumes: Task 1's exports.
- Produces: the `severity` column has `size`, `minSize` and `maxSize` of 96, header `"Severity"`, `enableResizing: false`. The `status` column has `size`, `minSize` and `maxSize` of 160, header `"Status"`. There is no `noise` column.

- [ ] **Step 1: Write the failing test**
  - `renderHook(() => useAlertTableCols({ presetName: "t", presetNoisy }))`, mocking `@/utils/hooks/useConfig` (`{ data: { NOISY_ALERTS_ENABLED: true } }`), `@/utils/hooks/useProviders`, `@/utils/hooks/useExpandedRows`, `@/features/alerts/alert-menu`, `../ui/alert-assignee` and `../ui/alert-extra-payload`.
  - Assert: no column with id `noise`; `severity` and `status` sizes are as in Interfaces.
  - Render the `cell` of `severity` and `status` with `{ row: { original: alert }, getValue: () => alert.status }`. Expect `Critical`, `Firing` and one `alert-noisy-segment` for a critical firing alert when `presetNoisy=true`, and none when `false`.

- [ ] **Step 2: Run the test and confirm it fails**
  Run: `npx jest src/widgets/alerts-table/lib/__tests__/alert-table-cols.test.tsx`
  Expected: FAIL (a `noise` column exists; size mismatch).

- [ ] **Step 3: Implement**
  - Severity cell: `<div className="flex items-center h-full pl-2"><TableSeverityCell …/><AlertSeverityBadge severity={…} size="sm" /></div>`, meta `!p-0 !w-[96px] !min-w-[96px] !max-w-[96px] !box-border flex-none` (th the same).
  - Status cell: `<div className="flex items-center h-full px-2"><AlertStatusPill status={context.getValue()} noisy={isAlertRingingNow(context.row.original, presetNoisy)} size="sm" /></div>`, meta width 160 in the same pattern.
  - Delete the `noise` column block and the `react-icons/md` import.
  - Update the header `dragStyle`.
  - Collapse both `leftPinnedColumns` ternaries to their non-noisy arrays.

- [ ] **Step 4: Run the tests and confirm they pass**
  Run: the Step 2 command, plus `npx jest src/widgets/alerts-table "src/app/(keep)/incidents/[id]/alerts"`. Expected: PASS.

- [ ] **Step 5: Commit**
  `git commit -am "feat(alerts-table): presets table shows severity, status and noisy as text"`

### Task 4: Gates and live demo

- [ ] `npm run typecheck`: no new errors compared with `origin/dev` (diff the error lists if dev already has some).
- [ ] `npx eslint` on the 7 changed source files and 3 test files: no errors.
- [ ] `npx jest` on every touched test file plus `src/widgets/alerts-table`: PASS.
- [ ] Live demo (worktree UI on :3002, dev gateway on :8090, data prefixed `atr`):
  - On `/dashboard/atr readability demo`, the noisy-preset widget shows Noisy on critical firing rows only, and the quiet-preset widget shows none.
  - On `/alerts/atr noisy`, the Severity and Status columns show words, and there is no bell column.
  - Dark mode stays legible.
