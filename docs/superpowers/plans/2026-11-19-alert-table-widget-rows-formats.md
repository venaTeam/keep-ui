# Alert Table widget: Rows and column formats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The dashboard Alert Table widget gets a saved per-widget row style (Compact / Relaxed) in the ⚙ panel, and saved per-column time and list formats in the edit-mode column header menu, matching the presets page.

**Architecture:** Three optional keys are added to the widget's `alertTable` config and exposed by `useWidgetColumnState`; defaults are never stored. The widget passes its saved row style to the `RowStyleOverrideProvider` it already renders. It passes its saved formats through the table's `meta`, which the shared cells already read first. One gate in the shared header menu lets format items show on a table with sorting off when sort items are hidden.

**Tech Stack:** Next.js 15, React 19, TypeScript, TanStack Table 8.21, Headless UI, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-19-alert-table-widget-rows-formats-design.md`

## Global Constraints

**Workspace**
- Worktree: `/Users/yarin/keep-namespace/.worktrees/alert-table-widget-rows/keep-ui`.
- Branch: `feat/alert-table-widget-rows-formats`, local only. Never push.
- Run every command from the worktree root.
- `P` below means `src/app/(keep)/dashboard/widget-types/preset`.

**Running tests and checks**
- Jest: `npx jest --runTestsByPath <paths>`. Paths with `(keep)` must go through `--runTestsByPath`, and must be quoted.
- Typecheck: `npm run typecheck`. The result must show 0 errors.
- Lint: `npx eslint <changed files>`. The result must show 0 errors, because lint is blocking on dev.

**Code style**
- No inline explanatory comments, only JSDoc/docstrings. Update the JSDoc you touch so it stays true.
- Defaults are never stored:
  - Compact is an absent `rowStyle`.
  - A time format of `"timeago"` or a list format of `"badges"` is an absent entry.
  - An empty format map is an absent key.
- A setter called with the value already in effect emits nothing.
- Copy, exact:
  - Section title: `Rows`.
  - Options: `Compact`, `Relaxed`.
  - Hints: `One line per row. Fits the most alerts.` (Compact) and `Long text wraps onto up to 3 lines. Fewer rows fit.` (Relaxed).

**Don't touch**
- The presets page, `alert-table-utils.tsx` and the gateway.
- The only shared edit is the format-items gate in `alert-table-headers.tsx` (Task 3).

## Review Focus

1. Picking the option already in effect (Compact on an untouched widget, Time ago on an unformatted column) must not mark the dashboard dirty. This is pinned in Task 1.
2. A hand-edited or unknown saved `rowStyle` (e.g. `"comfortable"`) must render Compact, not crash or go Relaxed. This is pinned in Tasks 1 and 2.
3. A widget left uncustomized must stay Compact even when the viewer chose Relaxed on the presets page. This is pinned in Task 2.
4. A saved non-default format on a generated date column whose value is missing must render an empty cell, not throw. This is pinned in Task 3.
5. A narrow widget (below 320 px) must still apply saved Relaxed and formats, with no header menu. This is pinned in Task 3.

---

### Task 1: Config keys and widget column state

**Files:**
- Modify: `src/app/(keep)/dashboard/types.tsx` (`AlertTableWidgetConfig`, ~line 85)
- Modify: `$P/alert-table-widget-config.ts`
- Modify: `$P/use-widget-column-state.ts`
- Test: `$P/__tests__/alert-table-widget-config.test.ts`, `$P/__tests__/use-widget-column-state.test.tsx`, `$P/__tests__/preset-widget-form.test.tsx`
- Modify (fixture only): `$P/__tests__/widget-table-settings.test.tsx` `makeState`, which gets the new fields' defaults so the file still typechecks.

**Interfaces:**
- Produces, in `types.tsx`, `AlertTableWidgetConfig` gains:
  - `rowStyle?: "relaxed" | null`
  - `columnTimeFormats?: Record<string, TimeFormatOption>`
  - `columnListFormats?: Record<string, ListFormatOption>`

  The types come from `@/widgets/alerts-table/lib/alert-table-time-format` and `@/widgets/alerts-table/lib/alert-table-list-format`.
- Produces, in `alert-table-widget-config.ts`:
  - `WidgetColumnChange` gains the same three keys.
  - `export const DEFAULT_TIME_FORMAT: TimeFormatOption = "timeago"`
  - `export const DEFAULT_LIST_FORMAT: ListFormatOption = "badges"`
  - `export function withoutDefaultFormats<T extends string>(formats: Record<string, T>, defaultFormat: T): Record<string, T>` drops entries equal to `defaultFormat` or empty.
  - `export function getWidgetRowStyle(item: WidgetData): RowStyle` returns `"relaxed"` only when `item.alertTable?.rowStyle === "relaxed"`, else `"default"`. `RowStyle` comes from `@/entities/alerts/model/useAlertRowStyle`.
- Produces, in `use-widget-column-state.ts`, `WidgetColumnState` gains:
  - `rowStyle: RowStyle`
  - `columnTimeFormats: Record<string, TimeFormatOption>`
  - `columnListFormats: Record<string, ListFormatOption>`
  - `setRowStyle(style: RowStyle): void`
  - `setColumnTimeFormats(formats: Record<string, TimeFormatOption>): void`
  - `setColumnListFormats(formats: Record<string, ListFormatOption>): void`

  The format maps read back from the saved config, falling back to a shared empty constant.
- Setter behaviour:
  - `setRowStyle` emits `{ rowStyle: "relaxed" }` or `{ rowStyle: null }`.
  - The format setters emit the `withoutDefaultFormats` map.
  - All three compare against the latest emitted widget (`latestItem.current`), resolved the same way, and emit nothing when unchanged. Use lodash `isEqual` for the maps.

- [ ] **Step 1: Write failing tests**

  In `alert-table-widget-config.test.ts`:
  - `withoutDefaultFormats({ a: "timeago", b: "iso" }, "timeago")` returns `{ b: "iso" }`.
  - `withoutDefaultFormats({ a: "timeago" }, "timeago")` returns `{}`.
  - `getWidgetRowStyle` gives `"relaxed"` for `{ alertTable: { rowStyle: "relaxed" } }`.
  - It gives `"default"` for no `alertTable`, for `rowStyle: null`, and for `rowStyle: "comfortable" as never`.
  - `applyWidgetColumnChange(item with alertTable { columnOrder: ["name"], rowStyle: "relaxed" }, { rowStyle: null })` gives `alertTable` equal to `{ columnOrder: ["name"] }`.
  - `applyWidgetColumnChange(item with alertTable { columnTimeFormats: { lastReceived: "iso" } }, { columnTimeFormats: {} })` gives a widget with no `alertTable`.

  In `use-widget-column-state.test.tsx`, add `describe("row style and formats")`. Use the stateful `useState` harness the file's "undoing a change on a default widget" tests use:
  - `"rowStyle is default when unset or unknown"`: unset gives `"default"`, and `rowStyle: "comfortable" as never` gives `"default"`.
  - `"setRowStyle('relaxed') then setRowStyle('default') leaves the widget as it was"`: the first emit has `alertTable: { rowStyle: "relaxed" }`; after the second, `alertTable` is undefined.
  - `"setRowStyle with the style in effect emits nothing"`: covers `"default"` on an untouched widget and `"relaxed"` on a relaxed one.
  - `"setColumnTimeFormats stores only non-default entries"`: calling it with `{ lastReceived: "relative", firingStartTime: "timeago" }` emits `alertTable.columnTimeFormats` equal to `{ lastReceived: "relative" }`.
  - `"setting every column back to Time ago removes columnTimeFormats"`: a widget saved `{ columnTimeFormats: { lastReceived: "iso" } }` gets `setColumnTimeFormats({ lastReceived: "timeago" })` and emits no `alertTable`.
  - `"setColumnTimeFormats equal to the saved map emits nothing"`: a widget saved `{ lastReceived: "iso" }` gets `{ lastReceived: "iso", firingStartTime: "timeago" }`, and `onChange` is not called.
  - `"setColumnListFormats stores only non-badges entries"`: `{ tags: "count", labels: "badges" }` emits `columnListFormats` equal to `{ tags: "count" }`.
  - `"a saved row style alone marks the widget customized"`: `alertTable: { rowStyle: "relaxed" }` gives `isCustomized` true.

  In `preset-widget-form.test.tsx`, next to `"emits alertTable.groupBy when a group is chosen, keeping other alertTable keys…"`, add:
  - `"choosing a group keeps the saved row style and formats"`.
  - Start from `tableWidget({ alertTable: { rowStyle: "relaxed", columnTimeFormats: { lastReceived: "date" }, columnListFormats: { tags: "count" } } })`.
  - Then `chooseGroupBy("Incident")`.
  - `lastValue(onChange).alertTable` equals those three keys plus `groupBy: "incident"`.

- [ ] **Step 2: Run them and see the new ones fail**

  Run: `npx jest --runTestsByPath "src/app/(keep)/dashboard/widget-types/preset/__tests__/alert-table-widget-config.test.ts" "src/app/(keep)/dashboard/widget-types/preset/__tests__/use-widget-column-state.test.tsx" "src/app/(keep)/dashboard/widget-types/preset/__tests__/preset-widget-form.test.tsx"`

  Expected: the new config and state tests FAIL (missing exports or fields). The form test may already PASS, since the form spreads the saved config; it pins that.

- [ ] **Step 3: Implement the interfaces above**

  Update the JSDoc of `useWidgetColumnState`, `applyWidgetColumnChange` and `AlertTableWidgetConfig` to mention the new keys and the defaults-never-stored rule. Add the three new fields' defaults to `makeState` in `widget-table-settings.test.tsx`: `"default"`, `{}`, `{}`, and `jest.fn()` setters.

- [ ] **Step 4: Run the three suites plus the settings suite; all pass. Then run `npm run typecheck`; 0 errors**

- [ ] **Step 5: Commit**

  ```bash
  git add "src/app/(keep)/dashboard/types.tsx" "src/app/(keep)/dashboard/widget-types/preset"
  git commit -m "feat(dashboard): Alert Table widget stores row style and column formats"
  ```

---

### Task 2: Rows control in the ⚙ panel, applied to the widget

**Files:**
- Create: `$P/row-style-control.tsx`
- Modify: `$P/widget-table-settings.tsx` (`SettingsContent`, ~line 600)
- Modify: `$P/widget-alerts-table.tsx` (the `WidgetAlertsTable` export and its JSDoc, ~line 595)
- Test: `$P/__tests__/row-style-control.test.tsx` (new), `$P/__tests__/widget-table-settings.test.tsx`, `$P/__tests__/widget-alerts-table.test.tsx`

**Interfaces:**
- Consumes: `WidgetColumnState.rowStyle` and `setRowStyle`, and `getWidgetRowStyle` (Task 1).
- Produces: `export function RowStyleControl(props: { value: RowStyle; onChange: (value: RowStyle) => void; titleAs?: ElementType; titleClassName?: string; "data-cy"?: string })`. It is built like `EmptyGroupPositionControl`:
  - a title (`Rows`, rendered as `titleAs`, default `p`);
  - a `radiogroup` labelled by the title, with native radios sharing a `useId` name;
  - options `default` → `Compact` and `relaxed` → `Relaxed`, with the same radio classes;
  - below the radios, the hint for the checked value in `text-[11px] text-gray-500`;
  - `data-cy` on the root, and `${data-cy}-default` / `${data-cy}-relaxed` on the radios.
- In `SettingsContent`, render it after the Group rows by block and its `EmptyGroupPositionControl`, before the footer:
  - `value={state.rowStyle}`
  - `onChange={state.setRowStyle}`
  - `titleAs="h5"`
  - `titleClassName={SECTION_TITLE_CLASS}`
  - `data-cy="dashboard-widget-table-settings-row-style"`
- In `WidgetAlertsTable`: `<RowStyleOverrideProvider value={getWidgetRowStyle(props.item)}>`.
- In the JSDoc, replace "Rows are plain, not clickable and always at the default density." with: rows are plain and not clickable, at the widget's saved row style (Compact unless saved Relaxed), whatever row style the viewer chose on the presets page.

- [ ] **Step 1: Write failing tests**

  `row-style-control.test.tsx`:
  - `"Compact is checked with its hint, and choosing Relaxed calls onChange('relaxed')"`. Query with `getByRole("radiogroup", { name: "Rows" })` and `getByRole("radio", { name: "Compact" })`, and check the hint text exactly.
  - `"Relaxed shows the relaxed hint"`.

  `widget-table-settings.test.tsx`, using the file's `openSettings` helper:
  - `"Rows sits after Group rows by and reflects state.rowStyle"`. Use `compareDocumentPosition`, as `preset-widget-form.test.tsx`'s `follows` does. With `makeState({ rowStyle: "relaxed" })`, Relaxed is checked.
  - `"choosing Relaxed calls setRowStyle('relaxed')"`.

  `widget-alerts-table.test.tsx`: keep `"rows keep the default density whatever the viewer's row style"` unchanged; it now pins the uncustomized case. Next to it, add:
  - `"a widget saved Relaxed renders relaxed rows whatever the viewer's row style"`:
    - set `localStorage "keephq-alert-table-row-style"` to `JSON.stringify("default")`;
    - render `{ presetColumns: ["name", "description"], alertTable: { rowStyle: "relaxed" } }`;
    - every body row has class `h-12` and not `h-8`;
    - every description cell contains `.line-clamp-3` and no `.line-clamp-1`.
  - `"an unknown saved row style renders compact rows"`: `alertTable: { rowStyle: "comfortable" as never }` gives rows with `h-8`.
  - In `describe("⚙ table settings")`, add `"choosing Relaxed in the panel saves the row style and the table turns relaxed"`:
    - use `renderWithSlot` in edit mode with `onChange`;
    - open the ⚙ button and click the `Relaxed` radio;
    - `onChange` is called once with `alertTable: { rowStyle: "relaxed" }`;
    - rerender with the emitted widget; rows have `h-12`.

- [ ] **Step 2: Run the three suites; the new tests fail**

  Run: `npx jest --runTestsByPath "src/app/(keep)/dashboard/widget-types/preset/__tests__/row-style-control.test.tsx" "src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-table-settings.test.tsx" "src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-alerts-table.test.tsx"`

  Expected: FAIL on the new tests only.

- [ ] **Step 3: Implement `RowStyleControl`, the panel section and the provider value as specified above**

- [ ] **Step 4: Run the same suites; all pass. `npm run typecheck`: 0 errors. `npx eslint` on the changed files: 0 errors**

- [ ] **Step 5: Commit**

  ```bash
  git add "src/app/(keep)/dashboard/widget-types/preset"
  git commit -m "feat(dashboard): Rows Compact / Relaxed in the Alert Table widget settings"
  ```

---

### Task 3: Format time and Format list in the widget's column menu

**Files:**
- Modify: `src/widgets/alerts-table/ui/alert-table-headers.tsx` (the `showFormatItems && column.getCanSort()` gate, ~line 376)
- Modify: `$P/widget-alerts-table.tsx` (`useReactTable` options ~line 379; `AlertsTableHeaders` props ~line 531; drop `NO_FORMATS` and `noop` if nothing else uses them; JSDoc)
- Test: `src/widgets/alerts-table/ui/__tests__/alert-table-headers.test.tsx`, `$P/__tests__/widget-alerts-table.test.tsx`

**Interfaces:**
- Consumes: `WidgetColumnState.columnTimeFormats`, `columnListFormats`, `setColumnTimeFormats` and `setColumnListFormats` (Task 1).
- Header gate: `showFormatItems && (column.getCanSort() || !showSortItems)`. That is the same condition the rename item already uses.
- Widget table:
  - `meta: { columnTimeFormats: state.columnTimeFormats, columnListFormats: state.columnListFormats }`, memoized on the two maps.
  - `AlertsTableHeaders` receives the state's maps and setters, and `showFormatItems={isEditMode}`.
- JSDoc: date and list columns render in the widget's saved formats. In edit mode, the header menu offers Format time on date columns and Format list on list columns.

- [ ] **Step 1: Write failing tests**

  `alert-table-headers.test.tsx`, using the harness. Render with `columnIds: ["lastReceived", "name"]` and open the menu with the file's `openMenuFor`:
  - `"with sorting disabled and sort items hidden, a date column offers Format time"`: use `enableSorting: false, showSortItems: false`. `screen.getByText("Format time")` exists.
  - `"with sorting disabled and the default props, there is no Format time, as on the presets page"`: use `enableSorting: false` and no `showSortItems`. `queryByText("Format time")` is null.

  `widget-alerts-table.test.tsx`. Every alert from `alertWith` has `lastReceived` `2026-10-01T10:00:00Z`.
  - `"a saved time format renders in that format"`: `{ presetColumns: ["name", "lastReceived"], alertTable: { columnTimeFormats: { lastReceived: "date" } } }` gives every `lastReceived` cell the text `"Oct 1, 2026"` (`format(date, "PP")`).
  - `"Format time in the edit-mode header menu saves the column's format"`:
    - edit mode with `onChange`;
    - open the `lastReceived` header menu (pattern of `openHeaderMenu`);
    - `pointerEnter` + `mouseMove` on `"Format time"`, as the headers test's `openRenameFor` does;
    - click `"Relative format (e.g. Today at 12:30 PM)"`;
    - `onChange` is called with `alertTable.columnTimeFormats` equal to `{ lastReceived: "relative" }`.
  - `"choosing Time ago on an unformatted column saves nothing"`: the same path, clicking `"Time ago (e.g. 5 minutes ago)"`; `onChange` is not called.
  - `"a saved list format renders in that format"`:
    - alerts with `tags: JSON.stringify(["a", "b", "c"])`;
    - `{ presetColumns: ["name", "tags"], alertTable: { columnListFormats: { tags: "count" } } }`;
    - the `tags` cell shows `"3"`.
  - `"a saved format on a missing generated date renders an empty cell"`:
    - alerts with `firingStartTime: undefined`;
    - `{ presetColumns: ["name", "firingStartTime"], alertTable: { columnTimeFormats: { firingStartTime: "iso" } } }`;
    - no throw, and the cell's text is `""`.
  - `"a narrow widget applies saved Relaxed and formats with no header menu"`:
    - `observeWidth(300)`, in edit mode with `onChange`;
    - `alertTable: { rowStyle: "relaxed", columnTimeFormats: { lastReceived: "date" } }`;
    - rows have `h-12`, `lastReceived` shows `"Oct 1, 2026"`, and `queryAllByTestId("dropdown-menu-button")` is empty.
  - `"view mode offers no header menu"`: no `dropdown-menu-button` without edit mode.

- [ ] **Step 2: Run both suites; the new tests fail**

  Run: `npx jest --runTestsByPath "src/widgets/alerts-table/ui/__tests__/alert-table-headers.test.tsx" "src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-alerts-table.test.tsx"`

- [ ] **Step 3: Implement the gate and the widget wiring as specified above**

- [ ] **Step 4: Verify**

  Run the same suites, plus every suite under `src/widgets/alerts-table` and `$P/__tests__`, and `src/app/(keep)/dashboard`. All pass.

  Then `npm run typecheck`: 0 errors. Then `npx eslint` on the changed files: 0 errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/widgets/alerts-table "src/app/(keep)/dashboard/widget-types/preset"
  git commit -m "feat(dashboard): Format time and Format list in the Alert Table widget column menu"
  ```

---

### After the tasks (main session)

- Run the whole branch review.
- Run full `npm test`, `npm run typecheck` and `npm run lint` on a Sonnet test lane.
- Do a browser check against a running gateway. Check that:
  - Relaxed works with group header rows (kept compact by `py-1`), the quick-action tray, the checkbox gutter, the noisy blink and pinned cells;
  - Format time works end to end with Save;
  - an untouched widget is unchanged.
