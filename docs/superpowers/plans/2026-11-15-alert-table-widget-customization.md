# Alert Table Widget Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **As built (2026-11-16).** Some details below were superseded during execution. The spec and the execution ledger are authoritative:
> - Uncustomized widgets fall back to the shared default order with no renames (R6). The widget never reads `usePresetColumnState`.
> - `alert-table-utils.tsx` is not edited (R10). Task 4b became a `RowStyleOverrideProvider` context, plus a widget-scoped `presetName`.
> - `renderToolbar` was replaced by a slot plus portal that puts the ⚙ right before "Go to preset" (R12).
> - `NARROW_WIDGET_PX` is 320, not 420 (R13).
> - `get-column-value.ts` was removed. Its camelCase rule lives in `resolveWidgetColumnId`.
> - Labels coexist with Count (R11): "Group rows by", "Rows with no value", "Rows grouped by".

**Goal:** Let dashboard editors reorder, resize, show/hide, rename and group (including by incident) the columns of the dashboard Alert Table widget, saved per widget with the dashboard.

**Architecture:**
- The hand-built CSS-grid widget is replaced by a small TanStack table assembled from the presets-page parts: `useAlertTableCols`, `AlertsTableHeaders`, `AlertsTableBody` and `GroupedRow`.
- A widget-only settings store (`useWidgetColumnState`) reads and writes `item.presetColumns` and a new optional `item.alertTable`. Unset parts fall back to the preset's real column config via `usePresetColumnState`.
- Controls exist only in dashboard edit mode. Changes flow through the existing `onSave` (`handleSaveEdit`) path into the dashboard's unsaved edit state.

**Tech Stack:** Next.js 15, React 19, TypeScript, TanStack Table 8.21, dnd-kit, Tremor, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-alert-table-widget-customization-design.md` (read it first; requirement numbers below refer to it).

## Global Constraints

- **Location:** keep-ui only. Work in `/Users/yarin/keep-namespace/.worktrees/alert-table-widget-customization/keep-ui` on branch `feat/alert-table-widget-customization`. Commit locally after each task. Never push, never open a PR, never touch `dev`/`main`.
- **Comments:** no inline explanatory comments in code. Only JSDoc/docstrings on exported functions, hooks and components.
- **Presets page:** must behave exactly as today, except that group headers for empty values read "No <column>" instead of "undefined"/"null". Every new prop on a shared component defaults to today's behaviour.
- **Widget-only exclusions:**
  - Never-shown columns: `checkbox`, `alertMenu`, `noise`.
  - Left-pinned: `severity`, `status`, `source` (when visible).
- **Widget default columns** (when `presetColumns` is unset): `severity, status, source, name, description, lastReceived`. This is the existing `defaultColumns` in `src/app/(keep)/dashboard/widget-types/preset/constants.ts`.
- **"No <column>" group:**
  - The label is `No <label>`. Incident uses `No incident`.
  - Default position `"top"`.
  - Values treated as empty: `undefined`, `null`, `""`, `"undefined"`, `"null"`, empty array. TanStack's grouped rows carry the **stringified** grouping key, so the strings matter.
- **Narrow widget threshold:** `420` px. Below it, header controls are hidden even in edit mode.
- **Grouping hint** in the form: `Grouping works best with 20 or more alerts`, shown when Group by is set and the count is under `10`.
- **Group-by shortlist:** see Ruling R11 below. It is built from `COUNT_BY_ALERT_FIELD_OPTIONS`.
  - **Spec deviation:** Severity is dropped, because `severity` is a TanStack display column with no accessor (`alert-table-utils.tsx:432`) and cannot be grouped.
- **Checks before each commit:**
  - `npx jest <touched test files>`;
  - `npx tsc --noEmit -p .` must not add new errors in touched files (compare against `origin/dev` output; the repo has pre-existing errors);
  - `npx eslint <touched files>`.
- **Coordination:** another branch (`feat/alert-table-readability`) edits `alert-table-utils.tsx`, `widget-alerts-table.tsx` and one line of `alert-table-headers.tsx`. This branch does not edit `alert-table-utils.tsx` at all (Ruling R10). See `/Users/yarin/keep-namespace/.worktrees/COORDINATION-alert-table.md`.
- **Spec resolutions:** the spec's "Builder-check resolutions" section is binding. It covers legacy snake_case ids, static-preset fallback, ignoring viewer preferences, the single empty group, and multi-key changes in one `onSave`.

## Review Focus

1. **Legacy widgets saved with facet-list snake_case ids** (`last_received`) must still show the value. Today `getColumnValue` falls back to camelCase. Owner: Task 1 (`resolveWidgetColumnId`) and the Task 6 test.
2. **Dragging a column the preset's saved order doesn't contain** (any generated field such as `service`) must not corrupt the order. `onDragEnd` does `indexOf` → `-1` → `splice(-1, 1)`. Owner: Task 1 (`normalizeColumnOrder`) and a Task 2 test.
3. **Saved config naming unknown or excluded ids** (`checkbox`, a field no longer present, a stale `groupBy`) must be ignored with no crash. A `groupBy` naming a column that can't group renders ungrouped. Owner: Task 1 and Task 6 tests.
4. **The 30-second refresh while grouped:** a collapsed group must stay collapsed after the alerts refetch, and settings must not reset. Owner: Task 6 test.
5. **Edit-mode round trip:** a change inside the widget must survive the dashboard's Save, disappear on Cancel, and not change the widget's grid size. Owner: Task 7 test.

## Coexistence with the existing Count feature (Ruling R11, user requirement 2026-11-15)

The dashboard already has the **Count** feature (`item.countBy`, `count-by-control.tsx`, `src/entities/presets/model/count-by.ts`). It applies to the Alert Table and Alert Count widgets: Count Alerts / Incidents / Other field, a "+N alerts not in an incident" line, and an optional blink. This branch must not collide with it in storage, the widget, or the create/update modal.

- **Storage:** row grouping is `alertTable.groupBy`. It never reads or writes `countBy`. The two settings are independent: no defaulting, no syncing.
- **Modal:**
  - The new control is labelled **"Group rows by"** (data-cy `dashboard-widget-form-group-rows-by`). The empty-group setting is labelled **"Rows with no value"** (`Top` / `Bottom`).
  - Both appear only for Alert Table, placed after the Columns picker.
  - The existing **Count** control, its position, labels, data-cy attributes and its tests are untouched. The Alert Count Panel form gets nothing new.
- **Shared labels:** the Group rows by shortlist reuses the Count control's field ids and labels from `COUNT_BY_ALERT_FIELD_OPTIONS`. It is not a second copy.
  - The shortlist is: `incident` "Incident", then each `COUNT_BY_ALERT_FIELD_OPTIONS` entry in its order (Alert name, Service, Host, Application, Site, Assignee), then `source` "Source", `status` "Status".
  - `getColumnLabel` uses the same labels.
- **⚙ panel and chip:** the panel section is titled "Group rows by". The chip above the table reads "Rows grouped by <label>".
- **Two counts on one widget:** the Count line ("+13 alerts not in an incident") covers the whole preset, while groups cover the loaded rows. In the widget (`showIncidentDetails`), every group header's count reads "<n> shown". The "No incident" header reads "No incident · <n> shown".
- **Panel layout:** the Count lines (group count, missing line, alerts count) and "Go to preset" keep their order and test ids. The ⚙ button goes immediately before "Go to preset", edit mode only.
- **Regression guard:** `count-by-control.test.tsx`, `widget-alert-count-panel*.test.tsx`, `preset-alert-table-panel.test.tsx` and `preset-widget-form.test.tsx` count-by cases must stay green unchanged.

---

### Task 1: Widget config types and pure column-state helpers

**Files:**
- Modify: `src/app/(keep)/dashboard/types.tsx` (add `presetColumns?: string[]` and `alertTable?: AlertTableWidgetConfig` to `WidgetData`; export the new types)
- Modify: `src/app/(keep)/dashboard/widget-type-fields.ts` (add `"alertTable"` to `TYPE_FIELDS[WidgetType.PRESET]`)
- Create: `src/app/(keep)/dashboard/widget-types/preset/alert-table-widget-config.ts`
- Test: `src/app/(keep)/dashboard/widget-types/preset/__tests__/alert-table-widget-config.test.ts`; extend `src/app/(keep)/dashboard/__tests__/widget-type-fields.test.ts`

**Interfaces:**
- Produces (all exported from `alert-table-widget-config.ts`):
  - `type EmptyGroupPosition = "top" | "bottom"`
  - `interface AlertTableWidgetConfig { columnOrder?: string[]; columnRenameMapping?: Record<string, string>; columnSizing?: Record<string, number>; groupBy?: string | null; emptyGroupPosition?: EmptyGroupPosition }` (declared in `types.tsx`, re-exported here)
  - `const WIDGET_EXCLUDED_COLUMNS: readonly string[]`, `const WIDGET_PINNED_LEFT: readonly string[]`, `const NARROW_WIDGET_PX = 420`
  - `resolveWidgetColumnId(id: string, knownIds: ReadonlySet<string>): string`
  - `getVisibleColumnIds(item: WidgetData, knownIds: ReadonlySet<string>): string[]`
  - `normalizeColumnOrder(order: readonly string[], allIds: readonly string[]): string[]`
  - `toVisibilityState(visibleIds: readonly string[], allIds: readonly string[]): VisibilityState`
  - `visibleIdsFromVisibilityState(next: VisibilityState, previousVisible: readonly string[]): string[]`
  - `type WidgetColumnChange = { columnOrder?: string[]; visibleColumns?: string[]; columnRenameMapping?: Record<string, string>; columnSizing?: Record<string, number>; groupBy?: string | null; emptyGroupPosition?: EmptyGroupPosition }`
  - `applyWidgetColumnChange(item: WidgetData, change: WidgetColumnChange): WidgetData`
  - `resetWidgetColumns(item: WidgetData): WidgetData`
  - `isEmptyGroupValue(value: unknown): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
describe("resolveWidgetColumnId", () => {
  const known = new Set(["name", "lastReceived", "service", "labels.team"]);
  it("keeps an id the table knows", () => expect(resolveWidgetColumnId("service", known)).toBe("service"));
  it("maps a snake_case id to a known camelCase column", () => expect(resolveWidgetColumnId("last_received", known)).toBe("lastReceived"));
  it("never camelCases a dotted id", () => expect(resolveWidgetColumnId("labels.team_name", known)).toBe("labels.team_name"));
  it("keeps an unknown id as-is so it renders an empty column", () => expect(resolveWidgetColumnId("ticket_id", known)).toBe("ticket_id"));
});

describe("getVisibleColumnIds", () => {
  const known = new Set(["severity", "status", "source", "name", "description", "lastReceived", "checkbox"]);
  it("uses the widget defaults when presetColumns is unset", () =>
    expect(getVisibleColumnIds({} as WidgetData, known)).toEqual(["severity", "status", "source", "name", "description", "lastReceived"]));
  it("resolves legacy ids and drops excluded ones", () =>
    expect(getVisibleColumnIds({ presetColumns: ["name", "last_received", "checkbox"] } as WidgetData, known)).toEqual(["name", "lastReceived"]));
});

describe("normalizeColumnOrder", () => {
  it("drops unknown ids and appends missing ones in allIds order", () =>
    expect(normalizeColumnOrder(["description", "gone", "name"], ["severity", "name", "description", "service"]))
      .toEqual(["description", "name", "severity", "service"]));
});

describe("visibility round trip", () => {
  it("hiding one column keeps the rest in their previous order", () =>
    expect(visibleIdsFromVisibilityState({ name: false, service: true, description: true }, ["service", "name", "description"]))
      .toEqual(["service", "description"]));
  it("a newly shown column is appended", () =>
    expect(visibleIdsFromVisibilityState({ name: true, service: true }, ["name"])).toEqual(["name", "service"]));
});

describe("applyWidgetColumnChange / resetWidgetColumns", () => {
  const item = { i: "w1", presetColumns: ["name"], alertTable: { columnSizing: { name: 200 } } } as unknown as WidgetData;
  it("merges into alertTable without dropping other keys", () =>
    expect(applyWidgetColumnChange(item, { groupBy: "incident" }).alertTable).toEqual({ columnSizing: { name: 200 }, groupBy: "incident" }));
  it("writes visibleColumns to presetColumns", () =>
    expect(applyWidgetColumnChange(item, { visibleColumns: ["name", "service"] }).presetColumns).toEqual(["name", "service"]));
  it("does not mutate the input", () => { applyWidgetColumnChange(item, { groupBy: "x" }); expect(item.alertTable).toEqual({ columnSizing: { name: 200 } }); });
  it("reset removes presetColumns and alertTable", () => {
    const reset = resetWidgetColumns(item);
    expect(reset.presetColumns).toBeUndefined();
    expect(reset.alertTable).toBeUndefined();
  });
});

describe("isEmptyGroupValue", () => {
  it.each([undefined, null, "", "undefined", "null", []])("treats %p as empty", (v) => expect(isEmptyGroupValue(v)).toBe(true));
  it.each(["firing", 0, false, ["prometheus"]])("treats %p as a value", (v) => expect(isEmptyGroupValue(v)).toBe(false));
});
```

In `widget-type-fields.test.ts`, add: `stripForeignTypeFields` keeps `alertTable` for `PRESET`, and removes it when the widget becomes `HTML`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest "src/app/(keep)/dashboard/widget-types/preset/__tests__/alert-table-widget-config.test.ts" "src/app/(keep)/dashboard/__tests__/widget-type-fields.test.ts"`
Expected: FAIL (module not found / `alertTable` not kept).

- [ ] **Step 3: Implement the helpers**

- `resolveWidgetColumnId` follows the same rule as `get-column-value.ts`: exact id first, then `camelCase(id)` for undotted ids, but only when the camelCase id is in `knownIds`.
- `getVisibleColumnIds` = `(item.presetColumns ?? defaultColumns)` → resolve each → drop `WIDGET_EXCLUDED_COLUMNS` → de-duplicate, keeping the first occurrence.

- [ ] **Step 4: Run the tests to verify they pass**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(keep)/dashboard/types.tsx" "src/app/(keep)/dashboard/widget-type-fields.ts" "src/app/(keep)/dashboard/widget-types/preset/alert-table-widget-config.ts" "src/app/(keep)/dashboard/widget-types/preset/__tests__/alert-table-widget-config.test.ts" "src/app/(keep)/dashboard/__tests__/widget-type-fields.test.ts"
git commit -m "feat(dashboard): alert table widget config types and column-state helpers"
```

### Task 2: `useWidgetColumnState` hook (widget settings store with shared defaults)

> Ruling 2026-11-15 (spec "Builder-check resolutions" 2): the preset's presets-page layout is per user, so the store never reads `usePresetColumnState`. Fallback order = `normalizeColumnOrder(DEFAULT_COLS, allColumnIds)`; fallback renames = `{}`.

**Files:**
- Create: `src/app/(keep)/dashboard/widget-types/preset/use-widget-column-state.ts`
- Test: `src/app/(keep)/dashboard/widget-types/preset/__tests__/use-widget-column-state.test.tsx`

**Interfaces:**
- Consumes: Task 1 helpers; `DEFAULT_COLS` from `@/widgets/alerts-table/lib/alert-table-utils`.
- Produces:
  ```ts
  interface WidgetColumnState {
    columnOrder: string[];
    columnVisibility: VisibilityState;
    visibleColumns: string[];
    columnRenameMapping: Record<string, string>;
    columnSizing: ColumnSizingState;
    grouping: GroupingState;
    emptyGroupPosition: EmptyGroupPosition;
    isCustomized: boolean;
    canEdit: boolean;
    setColumnOrder(order: string[]): void;
    setColumnVisibility(next: VisibilityState): void;
    setVisibleColumns(ids: string[]): void;
    setColumnRenameMapping(mapping: Record<string, string>): void;
    setColumnSizing(updater: Updater<ColumnSizingState>): void;
    setGrouping(updater: Updater<GroupingState>): void;
    setEmptyGroupPosition(position: EmptyGroupPosition): void;
    reset(): void;
  }
  function useWidgetColumnState(args: {
    item: WidgetData;
    allColumnIds: string[];
    onChange?: (item: WidgetData) => void;
  }): WidgetColumnState;
  ```

- [ ] **Step 1: Write the failing tests**

```tsx
it("falls back to the shared default order and no renames when the widget has none", () => {
  const { result } = renderHook(() => useWidgetColumnState({ item: baseItem, allColumnIds: ["description", "service", "name", "severity"] }));
  expect(result.current.columnOrder).toEqual(["severity", "name", "description", "service"]);
  expect(result.current.columnRenameMapping).toEqual({});
  expect(result.current.isCustomized).toBe(false);
});
it("ignores whatever the viewer's browser holds for the preset", () => {
  localStorage.setItem("keephq-column-order-atw", JSON.stringify(["description", "name"]));
  localStorage.setItem("keephq-column-rename-mapping-atw", JSON.stringify({ name: "Mine" }));
  const { result } = renderHook(() => useWidgetColumnState({ item: baseItem, allColumnIds: ["name", "description"] }));
  expect(result.current.columnOrder).toEqual(["name", "description"]);
  expect(result.current.columnRenameMapping).toEqual({});
});
it("two changes in the same tick both survive", () => {
  const onChange = jest.fn();
  const { result } = renderHook(() => useWidgetColumnState({ item: baseItem, allColumnIds: ["name", "service"], onChange }));
  act(() => { result.current.setGrouping(["incident"]); result.current.setEmptyGroupPosition("bottom"); });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ alertTable: expect.objectContaining({ groupBy: "incident", emptyGroupPosition: "bottom" }) }));
});
it("widget order wins over the default and is normalized", () => {
  const item = { ...baseItem, alertTable: { columnOrder: ["name", "ghost"] } };
  const { result } = renderHook(() => useWidgetColumnState({ item, allColumnIds: ["severity", "name", "service"] }));
  expect(result.current.columnOrder).toEqual(["name", "severity", "service"]);
});
it("each setting falls back independently", () => {
  const item = { ...baseItem, alertTable: { columnRenameMapping: { description: "Details" } } };
  const { result } = renderHook(() => useWidgetColumnState({ item, allColumnIds: ["description", "name"] }));
  expect(result.current.columnOrder).toEqual(["name", "description"]);
  expect(result.current.columnRenameMapping).toEqual({ description: "Details" });
});
it("reset emits one change that removes presetColumns and alertTable", () => {
  const onChange = jest.fn();
  const item = { ...baseItem, presetColumns: ["name"], alertTable: { groupBy: "incident" } };
  const { result } = renderHook(() => useWidgetColumnState({ item, allColumnIds: ["name"], onChange }));
  act(() => result.current.reset());
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0].presetColumns).toBeUndefined();
  expect(onChange.mock.calls[0][0].alertTable).toBeUndefined();
});
it("setters emit the updated item through onChange", () => {
  const onChange = jest.fn();
  const { result } = renderHook(() => useWidgetColumnState({ item: baseItem, allColumnIds: ["name", "service"], onChange }));
  act(() => result.current.setGrouping(["incident"]));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ alertTable: expect.objectContaining({ groupBy: "incident" }) }));
  act(() => result.current.setColumnSizing((prev) => ({ ...prev, name: 240 })));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ alertTable: expect.objectContaining({ columnSizing: { name: 240 } }) }));
});
it("every column, including generated ones not in DEFAULT_COLS, is in the order", () => {
  const { result } = renderHook(() => useWidgetColumnState({ item: baseItem, allColumnIds: ["name", "description", "service"] }));
  expect(result.current.columnOrder).toEqual(["name", "description", "service"]);
});
it("without onChange the setters are no-ops and canEdit is false", () => {
  const { result } = renderHook(() => useWidgetColumnState({ item: baseItem, allColumnIds: [] }));
  expect(result.current.canEdit).toBe(false);
  expect(() => act(() => result.current.setGrouping(["incident"]))).not.toThrow();
});
it("grouping defaults to none and emptyGroupPosition to top", () => {
  const { result } = renderHook(() => useWidgetColumnState({ item: baseItem, allColumnIds: [] }));
  expect(result.current.grouping).toEqual([]);
  expect(result.current.emptyGroupPosition).toBe("top");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest "src/app/(keep)/dashboard/widget-types/preset/__tests__/use-widget-column-state.test.tsx"`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `useWidgetColumnState`**

- Fallbacks: order `normalizeColumnOrder(item.alertTable?.columnOrder ?? DEFAULT_COLS, allColumnIds)`; renames `item.alertTable?.columnRenameMapping ?? {}`; sizing `?? {}`.
- `reset()` emits exactly one change: `resetWidgetColumns(latestItem)`.
- Setters build on a ref holding the latest emitted widget. The ref is updated synchronously in each emit and re-synced when `item` changes. Two setter calls in one tick therefore compose instead of overwriting each other.
- `grouping` = `groupBy && allColumnIds.includes(groupBy) ? [groupBy] : []`.
- `setGrouping`/`setColumnSizing` resolve TanStack updaters against the current value before calling `applyWidgetColumnChange`.
- `isCustomized` = `presetColumns !== undefined || alertTable` has any key.

- [ ] **Step 4: Run the tests to verify they pass**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(keep)/dashboard/widget-types/preset/use-widget-column-state.ts" "src/app/(keep)/dashboard/widget-types/preset/__tests__/use-widget-column-state.test.tsx"
git commit -m "feat(dashboard): widget column-state store with preset fallback"
```

### Task 3: Shared header — non-interactive mode, menu without sort, rightmost fix

**Files:**
- Modify: `src/widgets/alerts-table/ui/alert-table-headers.tsx` (props; the menu block at lines 343-467; `isRightmostColumn` at 248-254)
- Test: `src/widgets/alerts-table/ui/__tests__/alert-table-headers.test.tsx` (new)

**Interfaces:**
- Produces: `AlertsTableHeaders` gains optional props `interactive?: boolean` (default `true`), `showSortItems?: boolean` (default `true`), `showFormatItems?: boolean` (default `true`). These are passed through to `DraggableHeaderCell`.

- [ ] **Step 1: Write the failing tests**

Use a test harness component that builds a real `useReactTable` with columns `name`, `description`, `service` (plain accessors with `enableGrouping: true`). Pass `columnOrder`/`columnVisibility` state and stub setters, then render `<Table><AlertsTableHeaders …/></Table>`. Mock `useAlertRowStyle` to `["default", jest.fn()]`.

```tsx
it("default props render the drag handle and menu exactly as the presets page does", () => {
  renderHeaders({});
  expect(screen.getByTestId("drag-handle-name")).toBeInTheDocument();
  expect(screen.getByTestId("resize-handle-name")).toBeInTheDocument();
});
it("interactive=false renders no drag handle, resize edge or menu", () => {
  renderHeaders({ interactive: false });
  expect(screen.queryByTestId("drag-handle-name")).toBeNull();
  expect(screen.queryByTestId("resize-handle-name")).toBeNull();
  expect(screen.queryByRole("button", { name: /column menu|open menu/i })).toBeNull();
});
it("with sorting disabled the menu still offers Rename and Group by, and no sort items", async () => {
  renderHeaders({ enableSorting: false, showSortItems: false, showFormatItems: false });
  await openMenuFor("name");
  expect(screen.getByText("Group by")).toBeInTheDocument();
  expect(screen.getByText(/rename/i)).toBeInTheDocument();
  expect(screen.queryByText("Sort ascending")).toBeNull();
});
it("Move right is disabled only on the last column when there is no alertMenu column", async () => {
  renderHeaders({});
  await openMenuFor("description");
  expect(screen.getByText("Move column right").closest("[aria-disabled='true'],[disabled]")).toBeNull();
  await openMenuFor("service");
  expect(screen.getByText("Move column right").closest("[aria-disabled='true'],[disabled]")).not.toBeNull();
});
```

`openMenuFor` clicks the menu trigger inside `screen.getByTestId("header-cell-<id>")`'s cell. Look at `@/shared/ui` `DropdownMenu` to find its trigger role/label.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/widgets/alerts-table/ui/__tests__/alert-table-headers.test.tsx`
Expected: the `interactive` / sort-disabled / rightmost tests FAIL; the default-props test PASSES.

- [ ] **Step 3: Implement**

- `interactive=false` hides the drag handle, the resize edge and the menu. It also disables `useSortable` (`disabled: !interactive || pinned`).
- Move the Rename and Group by items out of the `column.getCanSort() && (...)` block, gated on `column.getCanSort() || !showSortItems`. On the presets page this is identical to today, so `noise`/`extraPayload` gain nothing.
- Gate the two sort items on `showSortItems && column.getCanSort()`, and the time/list format items on `showFormatItems`.
- `isRightmostColumn` = the last visible leaf column that is not `alertMenu`. It must not throw with a single visible column. Add a test: with one visible column, opening its menu doesn't throw and Move right is disabled.

- [ ] **Step 4: Run the tests to verify they pass**

Run the same command, plus the presets-page suites that touch headers: `npx jest src/widgets/alerts-table`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/alerts-table/ui/alert-table-headers.tsx src/widgets/alerts-table/ui/__tests__/alert-table-headers.test.tsx
git commit -m "feat(alerts-table): header can render read-only and without sort items"
```

### Task 4: Shared body and grouped row — empty label, widget density, incident details

**Files:**
- Modify: `src/widgets/alerts-table/ui/alert-grouped-row.tsx`
- Modify: `src/widgets/alerts-table/ui/alerts-table-body.tsx`
- Test: extend `src/widgets/alerts-table/ui/__tests__/alert-grouped-row.test.tsx`

**Interfaces:**
- Consumes: `isEmptyGroupValue` (Task 1). Import it from `@/app/(keep)/dashboard/widget-types/preset/alert-table-widget-config`, or move it to `src/widgets/alerts-table/lib/group-values.ts` and re-export it from Task 1's module. **Preferred:** move it, since shared code should not import from `app/`.
- Produces:
  - `GroupedRow` new optional props: `showIncidentDetails?: boolean` (default `false`), `linksDisabled?: boolean` (default `false`), `getColumnLabel?: (columnId: string) => string`.
  - `AlertsTableBody`: `onRowClick` becomes optional. New optional props: `rowStyleOverride?: RowStyle`, `showIncidentDetails?: boolean`, `linksDisabled?: boolean`, `getColumnLabel?: (columnId: string) => string`. These are passed through to `GroupedRow`. `rowStyleOverride` replaces `useAlertRowStyle()`'s value for rows, group rows and the skeleton.
  - `AlertsTableBody` and `GroupedRow` also get:
    - `rowAppearance?: "default" | "plain"` (default `"default"`): "plain" rows have no background class, no `cursor-pointer` and no hover colour, so the widget's tinted background shows through;
    - `selectable?: boolean` (default `true`): when false, rows render as plain `TableRow`s with no `SelectableGroup` around them.

- [ ] **Step 1: Write the failing tests** (follow the existing harness in `alert-grouped-row.test.tsx`)

```tsx
it("labels an empty generic group 'No <label>' instead of 'undefined'", () => {
  renderGroupedBy("service", [{ fingerprint: "a" }], { getColumnLabel: () => "Service" });
  expect(screen.getByText("No Service")).toBeInTheDocument();
  expect(screen.queryByText("undefined")).toBeNull();
});
it("labels the empty incident group 'No incident'", () => {
  renderGroupedBy("incident", [{ fingerprint: "a", incident: undefined }]);
  expect(screen.getByText("No incident")).toBeInTheDocument();
});
it("presets-page incident header is unchanged without showIncidentDetails", () => {
  renderGroupedBy("incident", [alertIn(inc("i1", "Checkout degraded", "firing", 14))]);
  expect(screen.getByText("Checkout degraded")).toBeInTheDocument();
  expect(screen.queryByText(/in incident/)).toBeNull();
});
it("with showIncidentDetails shows the linked name, status and 'x shown · y in incident'", () => {
  renderGroupedBy("incident", [alertIn(inc("i1", "Checkout degraded", "firing", 14)), alertIn(inc("i1", "Checkout degraded", "firing", 14))], { showIncidentDetails: true });
  expect(screen.getByRole("link", { name: "Checkout degraded" })).toHaveAttribute("href", "/incidents/i1");
  expect(screen.getByText(/firing/i)).toBeInTheDocument();
  expect(screen.getByText("2 shown · 14 in incident")).toBeInTheDocument();
});
it("an alert in two incidents links both names, shows no status and 'in 2 incidents'", () => {
  renderGroupedBy("incident", [alertIn(inc("i2", "Postgres storage", "firing", 2), inc("i3", "DB failover drill", "acknowledged", 2))], { showIncidentDetails: true });
  expect(screen.getByRole("link", { name: "Postgres storage" })).toHaveAttribute("href", "/incidents/i2");
  expect(screen.getByRole("link", { name: "DB failover drill" })).toHaveAttribute("href", "/incidents/i3");
  expect(screen.queryByText(/^firing$|^acknowledged$/i)).toBeNull();
  expect(screen.getByText("1 shown · in 2 incidents")).toBeInTheDocument();
});
it("plain, non-selectable body rows carry no bg-white or cursor-pointer and no SelectableGroup", () => {
  /* render AlertsTableBody with rowAppearance="plain" selectable={false}; mock react-selectable-fast's SelectableGroup to a marker element
     and assert the marker is absent and rows lack bg-white / cursor-pointer */
});
it("default body is unchanged: rows inside SelectableGroup", () => { /* marker present */ });
it("linksDisabled renders incident names as plain text", () => {
  renderGroupedBy("incident", [alertIn(inc("i1", "Checkout degraded", "firing", 14))], { showIncidentDetails: true, linksDisabled: true });
  expect(screen.queryByRole("link")).toBeNull();
});
it("clicking the incident link does not toggle the group", () => {
  const onToggle = jest.fn();
  renderGroupedBy("incident", [alertIn(inc("i1", "Checkout degraded", "firing", 14))], { showIncidentDetails: true, onToggleExpanded: onToggle });
  fireEvent.click(screen.getByRole("link", { name: "Checkout degraded" }));
  expect(onToggle).not.toHaveBeenCalled();
});
```

Here `inc(id, name, status, alerts_count)` builds an `incident_dto` entry with `user_generated_name`, and `alertIn(...incs)` sets `incident` to the ids joined by `","` and `incident_dto` to the entries.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/widgets/alerts-table/ui/__tests__/alert-grouped-row.test.tsx`
Expected: the new tests FAIL; the existing tests PASS.

- [ ] **Step 3: Implement**

- Detect empty groups with `isEmptyGroupValue(row.groupingValue)`. TanStack sets `groupingValue` to the stringified key.
- The empty label is `No incident` for `incident`, otherwise `No ${getColumnLabel?.(id) ?? startCase(id)}`.
- With `showIncidentDetails`, the empty incident group gets the plainer style from the mock (white background, grey left border, italic label).
- Incident status uses a small neutral badge with the status word.
- Link to `/incidents/<id>` with `next/link`. Its `onClick` stops propagation.
- In `AlertsTableBody`, call `onRowClick` only if provided.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/widgets/alerts-table`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/alerts-table/ui/alert-grouped-row.tsx src/widgets/alerts-table/ui/alerts-table-body.tsx src/widgets/alerts-table/ui/__tests__/alert-grouped-row.test.tsx src/widgets/alerts-table/lib/group-values.ts "src/app/(keep)/dashboard/widget-types/preset/alert-table-widget-config.ts"
git commit -m "feat(alerts-table): 'No <column>' group label and optional incident group details"
```

### Task 4b: Row-style override context (viewer preferences don't reach the widget)

> Ruling R10 (2026-11-15) replaces the earlier `ignoreStoredPreferences` design.
> - Editing `alert-table-utils.tsx` would sit next to `feat/alert-table-readability`'s hunk at lines 251-256, and the viewer's row style is also read directly by `AlertName`, `alert-table-headers.tsx`, `alerts-table-body.tsx` and `alert-grouped-row.tsx`.
> - So the override lives in `useAlertRowStyle` itself, as a React context every reader picks up.
> - Stored renames, time/list formats and expanded rows are neutralised by Ruling R9 instead: the widget passes a widget-scoped `presetName` (`dashboard-widget-<item.i>`), so those preset-keyed browser keys are never the presets page's.
> - `alert-table-utils.tsx` is NOT edited by this branch.

**Files:**
- Modify: `src/entities/alerts/model/useAlertRowStyle.ts`
- Modify: `src/entities/alerts/model/index.ts` (export the provider)
- Test: `src/entities/alerts/model/__tests__/useAlertRowStyle.test.tsx` (new)

**Interfaces:**
- Produces:
  - `RowStyleOverrideProvider`: a React context provider with prop `value: RowStyle | null`.
  - `useAlertRowStyle()` keeps its signature `readonly [RowStyle, (v: RowStyle) => void]`. Inside a provider with a non-null value, it returns that value as the row style. The setter still writes the stored preference.
  - Outside any provider, behaviour is unchanged.

- [ ] **Step 1: Write the failing tests**

```tsx
it("returns the stored preference with no provider", () => {
  localStorage.setItem("keephq-alert-table-row-style", JSON.stringify("relaxed"));
  const { result } = renderHook(() => useAlertRowStyle());
  expect(result.current[0]).toBe("relaxed");
});
it("returns the override inside RowStyleOverrideProvider", () => {
  localStorage.setItem("keephq-alert-table-row-style", JSON.stringify("relaxed"));
  const wrapper = ({ children }) => <RowStyleOverrideProvider value="default">{children}</RowStyleOverrideProvider>;
  const { result } = renderHook(() => useAlertRowStyle(), { wrapper });
  expect(result.current[0]).toBe("default");
});
it("a null override falls back to the stored preference", () => { /* value={null} → "relaxed" */ });
it("AlertName inside the provider renders at the overridden density", () => {
  /* render AlertName (src/entities/alerts/ui/AlertName) with stored "relaxed" inside value="default";
     assert the default-density class it uses (e.g. line-clamp-1 rather than line-clamp-3) */
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/entities/alerts/model/__tests__/useAlertRowStyle.test.tsx`
Expected: the provider tests FAIL (no provider export).

- [ ] **Step 3: Implement**

Use `createContext<RowStyle | null>(null)`. `useAlertRowStyle` reads the context and the stored value, and returns `[override ?? stored, setter]`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/entities/alerts src/widgets/alerts-table`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/entities/alerts/model/useAlertRowStyle.ts src/entities/alerts/model/index.ts src/entities/alerts/model/__tests__/useAlertRowStyle.test.tsx
git commit -m "feat(alerts): row-style override context for embedded tables"
```

### Task 5: Column options and the Group by select

**Files:**
- Create: `src/widgets/alerts-table/lib/alert-column-options.ts`
- Modify: `src/widgets/alerts-table/ui/ColumnSelection.tsx` (replace its inline `COMMON_ENRICHMENT_FIELDS` array with the import; no other change)
- Create: `src/app/(keep)/dashboard/widget-types/preset/group-by-select.tsx`
- Test: `src/widgets/alerts-table/lib/__tests__/alert-column-options.test.ts`, `src/app/(keep)/dashboard/widget-types/preset/__tests__/group-by-select.test.tsx`

**Interfaces:**
- Produces:
  - `COMMON_ENRICHMENT_FIELDS: readonly string[]` (moved verbatim from `ColumnSelection.tsx`).
  - `GROUP_BY_SHORTLIST: ReadonlyArray<{ value: string; label: string }>`, built per R11 from `COUNT_BY_ALERT_FIELD_OPTIONS`. It is never a copied list.
  - `getAlertColumnOptions(tableColumnIds: readonly string[], extraFields: readonly string[]): string[]` returns the de-duplicated union, minus `checkbox`, `alertMenu`, `noise`, sorted alphabetically.
  - `getColumnLabel(columnId: string, renameMapping?: Record<string, string>): string` returns the rename, else the shortlist label, else `startCase(columnId)`.
  - `GroupBySelect` props `{ value: string | null; onChange: (value: string | null) => void; fieldOptions: string[]; "data-testid"?: string }`. It renders "None", the shortlist, a divider, then a search-filtered list of `fieldOptions` not in the shortlist ("Any other field…").

- [ ] **Step 1: Write the failing tests**

```ts
it("options merge table columns and extra fields without excluded ids", () =>
  expect(getAlertColumnOptions(["name", "checkbox", "service"], ["labels.team", "service"])).toEqual(["labels.team", "name", "service"]));
it("labels prefer the rename, then the shortlist, then startCase", () => {
  expect(getColumnLabel("node_name")).toBe("Host");
  expect(getColumnLabel("node_name", { node_name: "Server" })).toBe("Server");
  expect(getColumnLabel("labels.team")).toBe("Labels Team");
});
```

```tsx
it("lists None, then Incident first in the shortlist", async () => { /* open select, read option order */ });
it("choosing Incident calls onChange('incident'); None calls onChange(null)", async () => { /* … */ });
it("searching shows matching non-shortlist fields", async () => { /* type 'region' → 'labels.region' option */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/widgets/alerts-table/lib/__tests__/alert-column-options.test.ts "src/app/(keep)/dashboard/widget-types/preset/__tests__/group-by-select.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Use Tremor `SearchSelect` (or `Select` with a search input) for `GroupBySelect`. Match the styling of `count-by-control.tsx`.

- [ ] **Step 4: Run the tests to verify they pass**

Same command, plus `npx jest src/widgets/alerts-table/ui` (ColumnSelection unchanged). Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/alerts-table/lib/alert-column-options.ts src/widgets/alerts-table/lib/__tests__/alert-column-options.test.ts src/widgets/alerts-table/ui/ColumnSelection.tsx "src/app/(keep)/dashboard/widget-types/preset/group-by-select.tsx" "src/app/(keep)/dashboard/widget-types/preset/__tests__/group-by-select.test.tsx"
git commit -m "feat(alerts-table): shared column options and Group by select"
```

### Task 6: Rebuild `WidgetAlertsTable` on the shared table parts

**Files:**
- Rewrite: `src/app/(keep)/dashboard/widget-types/preset/widget-alerts-table.tsx`
- Create: `src/app/(keep)/dashboard/widget-types/preset/empty-group-row-model.ts`
- Rewrite: `src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-alerts-table.test.tsx`
- Test: `src/app/(keep)/dashboard/widget-types/preset/__tests__/empty-group-row-model.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5; `useAlertTableCols` (`@/widgets/alerts-table/lib/alert-table-utils`); `AlertsTableHeaders`; `AlertsTableBody`; `useGroupExpansion`.
- Produces:
  - `withEmptyGroupPosition<T>(base: (table: Table<T>) => () => RowModel<T>, getPosition: () => EmptyGroupPosition): (table: Table<T>) => () => RowModel<T>`. It reorders only the top-level `rows`, moving the one with `isEmptyGroupValue(row.groupingValue)` to the start or end, and keeps `flatRows`/`rowsById`. It is memoized on the identity of the base model, so it returns the same object for the same base model and position.
  - `WidgetAlertsTable` props:
    ```ts
    interface WidgetAlertsTableProps {
      item: WidgetData;
      presetName: string;
      presetId?: string;
      presetNoisy?: boolean;
      alerts?: AlertDto[];
      background?: string;
      isEditMode: boolean;
      onChange?: (item: WidgetData) => void;
    }
    ```
    It also exports `useWidgetTable(...)` only if the settings panel (Task 8) needs the same `table` and `WidgetColumnState`. **Preferred:** `WidgetAlertsTable` accepts `renderToolbar?: (ctx: { state: WidgetColumnState; columnIds: string[] }) => ReactNode`, so the panel component in Task 7 can mount the ⚙ panel with the same state.

- [ ] **Step 1: Write the failing tests**

Mock `@/utils/hooks/useProviders`, `@/utils/hooks/useConfig` and `@/entities/presets/model` (`usePresetColumnState`), plus `next/navigation`.

```tsx
it("legacy snake_case column shows the camelCase value", () => {
  render(<WidgetAlertsTable item={{ ...item, presetColumns: ["name", "last_received"] }} presetName="feed" alerts={[{ ...alert, lastReceived: "2026-10-01T10:00:00Z" }]} isEditMode={false} />);
  expect(screen.getByTestId("header-cell-lastReceived")).toBeInTheDocument();
});
it("an uncustomized widget orders columns by the preset store, not old local storage", () => {
  mockPresetColumnState({ columnOrder: ["description", "name"], columnRenameMapping: { name: "Alert" } });
  localStorage.setItem("keephq-column-order-atw", JSON.stringify(["name", "description"]));
  renderWidget({ presetColumns: ["name", "description"] });
  expect(headerIds()).toEqual(["description", "name"]);
  expect(screen.getByText("Alert")).toBeInTheDocument();
});
it("widget order and renames win", () => {
  renderWidget({ presetColumns: ["name", "description"], alertTable: { columnOrder: ["name", "description"], columnRenameMapping: { description: "Details" } } });
  expect(headerIds()).toEqual(["name", "description"]);
  expect(screen.getByText("Details")).toBeInTheDocument();
});
it("a configured column no alert has renders empty cells", () => {
  renderWidget({ presetColumns: ["name", "ticket_id"] });
  expect(screen.getAllByTestId(/alerts-cell-ticket_id|^alerts-cell-ticket_id$/).length).toBeGreaterThan(0);
});
it("unknown and excluded ids in config are ignored", () => {
  expect(() => renderWidget({ presetColumns: ["checkbox", "name"], alertTable: { columnOrder: ["alertMenu", "name"], groupBy: "does_not_exist" } })).not.toThrow();
  expect(headerIds()).toEqual(["name"]);
});
it("groups by incident with 'No incident' first by default", () => {
  renderWidget({ alertTable: { groupBy: "incident" } }, [linkedAlert("i1", "Checkout degraded"), unlinkedAlert()]);
  const headers = screen.getAllByTestId? /* data-cy alerts-group-header */;
  expect(groupHeaderTexts()[0]).toMatch(/^No incident/);
});
it("null, undefined and empty-string values form ONE 'No Service' group", () => {
  renderWidget({ alertTable: { groupBy: "service" } }, [alertWith({ service: null }), alertWith({ service: undefined }), alertWith({ service: "" }), alertWith({ service: "checkout" })]);
  expect(groupHeaderTexts().filter((t) => t.startsWith("No Service"))).toHaveLength(1);
});
it("headers ignore the stale unscoped rename key in local storage", () => {
  localStorage.setItem("keephq-column-rename-mapping-atw", JSON.stringify({ description: "Stale" }));
  renderWidget({ presetColumns: ["name", "description"] });
  expect(screen.queryByText("Stale")).toBeNull();
});
it("emptyGroupPosition bottom puts 'No incident' last", () => {
  renderWidget({ alertTable: { groupBy: "incident", emptyGroupPosition: "bottom" } }, [unlinkedAlert(), linkedAlert("i1", "Checkout degraded")]);
  expect(groupHeaderTexts().at(-1)).toMatch(/^No incident/);
});
it("view mode has no header controls; edit mode does", () => {
  const { rerender } = renderWidget({}, alerts, { isEditMode: false });
  expect(screen.queryByTestId("drag-handle-name")).toBeNull();
  rerender(widget({}, alerts, { isEditMode: true, onChange: jest.fn() }));
  expect(screen.getByTestId("drag-handle-name")).toBeInTheDocument();
});
it("a collapsed group stays collapsed after the alerts refresh", () => {
  const { rerender } = renderWidget({ alertTable: { groupBy: "incident" } }, [linkedAlert("i1", "Checkout degraded")]);
  fireEvent.click(groupHeader("Checkout degraded"));
  rerender(widget({ alertTable: { groupBy: "incident" } }, [linkedAlert("i1", "Checkout degraded"), linkedAlert("i1", "Checkout degraded")]));
  expect(screen.queryAllByTestId?.("alerts-row") ?? []).toHaveLength(0);
});
it("shows 5 skeleton rows while alerts are undefined", () => { /* alerts undefined → skeleton rows */ });
```

In `empty-group-row-model.test.ts`: (1) moves the empty group to the top or the bottom; (2) leaves ungrouped models untouched; (3) returns the identical object for the same base model and position.

Tests select by the existing `data-cy`/`data-testid` attributes (`alerts-group-header`, `alerts-row`, `header-cell-<id>`). Use `getAllByText`/`container.querySelectorAll('[data-cy="…"]')`. Do not invent new test ids unless needed.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest "src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-alerts-table.test.tsx" "src/app/(keep)/dashboard/widget-types/preset/__tests__/empty-group-row-model.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement**

- **Known ids:** the static column ids from `useAlertTableCols`, plus the keys of the loaded alerts. Derive the keys the same way `alert-table-tab-panel-server-side.tsx:59-85` does: move that derivation into `src/widgets/alerts-table/lib/additional-cols.ts` as `getAdditionalColsToGenerate(alerts: AlertDto[]): string[]`, and use it from both places. That file is in scope for this task.
- **`additionalColsToGenerate`:** that list, plus the visible ids, the `groupBy` id and `incident`, minus the ids of the static columns `useAlertTableCols` already defines.
- **`useAlertTableCols` arguments:** `isCheckboxDisplayed: false`, `isMenuDisplayed: false`, `presetName: \`dashboard-widget-${item.i}\`` (R9: widget-scoped, so the preset's stored renames, formats and expanded rows are never read), `presetNoisy`.
- **Group counts (R11):** with `showIncidentDetails`, every group header's count reads `<n> shown` (not "(n alerts)"), and the empty incident group reads `No incident · <n> shown`. Make this change in `alert-grouped-row.tsx`, gated on `showIncidentDetails` so the presets page is unchanged, and test it.
- **Row style:** wrap the whole widget table in `<RowStyleOverrideProvider value="default">` (Task 4b), and pass the same widget-scoped name as `presetName` to `AlertsTableBody`.
- **Pinned cells (R8):** plain rows make sticky pinned cells transparent. Give pinned header and body cells an opaque background (white, under the widget's tint) so horizontally scrolled content never shows through.
- **Empty grouping values:** post-process the returned column defs with `normalizeEmptyGrouping(columns)`, which goes in `empty-group-row-model.ts`. Each column's grouping value (its `getGroupingValue`, else its accessor) returns `undefined` whenever `isEmptyGroupValue(value)`, so all empties share one group key.
- **Header labels:** pass `AlertsTableHeaders` a rename mapping that has an entry for every visible non-icon column: the store's rename, else `getColumnLabel(id)`. A stale `columnDef.header` can never show through.
- **`useReactTable`:**
  - `getRowId: row => row.fingerprint`;
  - `enableSorting: false`, `manualSorting: true`, `enableGrouping: true`, `columnResizeMode: "onEnd"`;
  - `state` = `{ columnOrder, columnVisibility, columnSizing, grouping, columnPinning: { left: WIDGET_PINNED_LEFT ∩ visible, right: [] } }`;
  - `onColumnSizingChange` and `onGroupingChange` go to the store;
  - `getCoreRowModel()`;
  - `getGroupedRowModel: withEmptyGroupPosition(getGroupedRowModel(), () => state.emptyGroupPosition)`.
- **`AlertsTableHeaders`:** `interactive={isEditMode && !!onChange && !isNarrow}`, `showSortItems={false}`, `showFormatItems={false}`, the store's order/visibility/rename setters, and no-op time/list format setters with empty maps.
- **`AlertsTableBody`:** `rowStyleOverride="default"`, `rowAppearance="plain"`, `selectable={false}`, `showIncidentDetails`, `linksDisabled={isEditMode}`, `getColumnLabel` bound to the rename mapping, an empty `theme`, `lastViewedAlert={null}`, no `onRowClick`, `showSkeleton={!alerts}`, `pageSize={5}`.
- **Above the table when grouped:** the chip `Rows grouped by <label>` (with a ✕ calling `setGrouping([])` in edit mode only) and Expand all / Collapse all from `useGroupExpansion(true)`.
- **Narrow:** a `ResizeObserver` on the wrapper sets `isNarrow` when the width is under `NARROW_WIDGET_PX`.
- **Wrapper:** keep `data-cy="dashboard-widget-alerts-table"`, `overflow-x-auto`, the `background` style and `text-xs`.

- [ ] **Step 4: Run the tests to verify they pass**

Same command, plus `npx jest "src/app/(keep)/dashboard" src/widgets/alerts-table`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(keep)/dashboard/widget-types/preset/widget-alerts-table.tsx" "src/app/(keep)/dashboard/widget-types/preset/empty-group-row-model.ts" "src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-alerts-table.test.tsx" "src/app/(keep)/dashboard/widget-types/preset/__tests__/empty-group-row-model.test.ts" src/widgets/alerts-table/lib/additional-cols.ts "src/app/(keep)/alerts/[id]/ui/alert-table-tab-panel-server-side.tsx"
git commit -m "feat(dashboard): alert table widget renders through the shared alerts table"
```

### Task 7: Edit-mode plumbing — not inert, onSave, navigation off

**Files:**
- Modify: `src/app/(keep)/dashboard/GridItem.tsx:74-85` (inert exemption; pass `onSave` to `PresetGridItem`)
- Modify: `src/app/(keep)/dashboard/widget-types/preset/preset-grid-item.tsx` (accept and pass `onSave`)
- Modify: `src/app/(keep)/dashboard/widget-types/preset/preset-alert-table-panel.tsx` (pass `item`, `presetId`, `presetNoisy={!!preset?.is_noisy}`, `isEditMode`, `onChange`; disable "Go to preset" in edit mode; mount ⚙ via `renderToolbar` in edit mode only, wired to Task 8's component once it exists)
- Test: `src/app/(keep)/dashboard/__tests__/GridItem.test.tsx`, `src/app/(keep)/dashboard/widget-types/preset/__tests__/preset-alert-table-panel.test.tsx`, `src/app/(keep)/dashboard/__tests__/dashboard-edit-mode.test.tsx`

**Interfaces:**
- Consumes: `WidgetAlertsTable` props (Task 6); `useDashboardEditMode` (`../../DashboardEditModeContext`).
- Produces:
  - `PresetGridItem` prop `onSave?: (item: WidgetData) => void`;
  - `PresetAlertTablePanel` prop `onSave?: (item: WidgetData) => void`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("an alert-table widget body is not inert in edit mode", () => {
  renderGridItem(alertTableItem, { isEditMode: true });
  expect(screen.getByTestId?.("…") ?? container.querySelector('[data-cy="dashboard-widget-body"]')).not.toHaveAttribute("inert");
});
it("a metric widget body is still inert in edit mode", () => { /* unchanged behaviour */ });
/* GridItem.test.tsx ~line 170 currently asserts an Alert Table IS inert in edit mode: flip that assertion; keep the count-panel and other-widget assertions as they are. */
it("Go to preset is disabled in edit mode and works in view mode", () => { /* panel test */ });
it("passes edits to onSave in edit mode and not in view mode", () => { /* panel test: WidgetAlertsTable mock receives onChange only when editing */ });
```

In `dashboard-edit-mode.test.tsx`:

```tsx
it("a widget column change is kept on Save and dropped on Cancel, layout unchanged", async () => {
  /* enter edit mode → invoke the widget's onSave with { ...item, alertTable: { groupBy: "incident" } }
     → Save → saved dashboard_config contains alertTable.groupBy and the same x/y/w/h
     → repeat with Cancel → config unchanged */
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest "src/app/(keep)/dashboard/__tests__/GridItem.test.tsx" "src/app/(keep)/dashboard/widget-types/preset/__tests__/preset-alert-table-panel.test.tsx" "src/app/(keep)/dashboard/__tests__/dashboard-edit-mode.test.tsx"`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement**

- `inert={isEditMode && !isAlertCountPanel && !isAlertTablePanel && !item.genericMetrics}`, where `isAlertTablePanel = !!item.preset && (item.presetPanelType === PresetPanelType.ALERT_TABLE || !item.presetPanelType)`.
- `GridItem` passes `onSave={isEditMode ? onSave : undefined}`.
- In the panel, `isEditMode` comes from `useDashboardEditMode()`. Go to preset gets `disabled={isEditMode}`.

- [ ] **Step 4: Run the tests to verify they pass**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(keep)/dashboard/GridItem.tsx" "src/app/(keep)/dashboard/widget-types/preset/preset-grid-item.tsx" "src/app/(keep)/dashboard/widget-types/preset/preset-alert-table-panel.tsx" "src/app/(keep)/dashboard/__tests__/GridItem.test.tsx" "src/app/(keep)/dashboard/widget-types/preset/__tests__/preset-alert-table-panel.test.tsx" "src/app/(keep)/dashboard/__tests__/dashboard-edit-mode.test.tsx"
git commit -m "feat(dashboard): alert table widget edits flow into the dashboard edit session"
```

### Task 8: ⚙ Table settings panel

**Files:**
- Create: `src/app/(keep)/dashboard/widget-types/preset/widget-table-settings.tsx`
- Modify: `src/app/(keep)/dashboard/widget-types/preset/preset-alert-table-panel.tsx` (render it through `renderToolbar` in edit mode)
- Test: `src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-table-settings.test.tsx`

**Interfaces:**
- Consumes: `WidgetColumnState` (Task 2); `GroupBySelect`, `getAlertColumnOptions`, `getColumnLabel` (Task 5); `useFacetPotentialFields("alerts")` from `@/features/filter/hooks`.
- Produces: `WidgetTableSettings` props `{ state: WidgetColumnState; columnIds: string[] }`. It renders a ⚙ button with `data-cy="dashboard-widget-table-settings-btn"` that opens a popover with `data-cy="dashboard-widget-table-settings"`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("lists visible columns first in display order, then hidden ones", () => { /* … */ });
it("unchecking a column calls setVisibleColumns without it", () => { /* … */ });
it("renaming inline calls setColumnRenameMapping with the new name", () => { /* … */ });
it("reordering with the keyboard sensor calls setColumnOrder", () => { /* dnd-kit KeyboardSensor: focus handle, Space, ArrowDown, Space */ });
it("search adds a field as a visible column", () => { /* type 'region' → click 'labels.region' → setVisibleColumns([...visible, 'labels.region']) */ });
it("'Rows with no value' shows only when grouped and calls setEmptyGroupPosition", () => { /* … */ });
it("Reset to defaults calls reset and is disabled when not customized", () => { /* … */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest "src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-table-settings.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Use a Headless UI `Popover` with `@floating-ui/react` placement `bottom-end`, the same as `SettingsSelection.tsx`.
- The column list uses dnd-kit `SortableContext` with `verticalListSortingStrategy`, plus Pointer and Keyboard sensors.
- Pinned columns (`WIDGET_PINNED_LEFT`) show no drag handle.
- Copy: title `Table settings`; sections `Columns`, `Group rows by`, `Rows with no value` (options `Top` / `Bottom`); footer `Customized for this widget` + `Reset to defaults`.

- [ ] **Step 4: Run the tests to verify they pass**

Same command, plus `npx jest "src/app/(keep)/dashboard/widget-types/preset"`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(keep)/dashboard/widget-types/preset/widget-table-settings.tsx" "src/app/(keep)/dashboard/widget-types/preset/preset-alert-table-panel.tsx" "src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-table-settings.test.tsx"
git commit -m "feat(dashboard): widget table settings panel"
```

### Task 9: Widget form — Group rows by, no-value position, hint

**Files:**
- Modify: `src/app/(keep)/dashboard/widget-types/preset/preset-widget-form.tsx` (Alert Table section, below `ColumnsSelection`)
- Test: `src/app/(keep)/dashboard/widget-types/preset/__tests__/preset-widget-form.test.tsx`

**Interfaces:**
- Consumes: `GroupBySelect` (Task 5); `AlertTableWidgetConfig` (Task 1).
- Produces: the form's `onChange` payload gains `alertTable: { ...editingItem?.alertTable, groupBy, emptyGroupPosition }`. It is emitted only for `ALERT_TABLE`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("emits alertTable.groupBy when Group by is chosen, keeping other alertTable keys", () => {
  renderForm({ editingItem: { ...tableItem, alertTable: { columnOrder: ["name"] } } });
  chooseGroupBy("Incident");
  expect(lastPayload().alertTable).toEqual({ columnOrder: ["name"], groupBy: "incident", emptyGroupPosition: "top" });
});
it("shows 'Rows with no value' only when Group by is set", () => { /* … */ });
it("shows the hint when grouped with fewer than 10 alerts", () => {
  renderForm({ editingItem: { ...tableItem, preset: { ...tableItem.preset, countOfLastAlerts: 5 } } });
  chooseGroupBy("Incident");
  expect(screen.getByText("Grouping works best with 20 or more alerts")).toBeInTheDocument();
});
it("Alert Count Panel payload has no alertTable", () => { /* … */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest "src/app/(keep)/dashboard/widget-types/preset/__tests__/preset-widget-form.test.tsx"`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement**

Keep `groupBy`/`emptyGroupPosition` in `useState`, seeded from `editingItem?.alertTable`, following the `countBy` pattern in the same file. Get the field options from `useFacetPotentialFields("alerts")`.

- [ ] **Step 4: Run the tests to verify they pass**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(keep)/dashboard/widget-types/preset/preset-widget-form.tsx" "src/app/(keep)/dashboard/widget-types/preset/__tests__/preset-widget-form.test.tsx"
git commit -m "feat(dashboard): Group by and no-value position in the alert table widget form"
```

### Task 10: Whole-branch verification and live demo check

**Files:** none (verification only); append to `/Users/yarin/keep-namespace/.worktrees/COORDINATION-alert-table.md`.

- [ ] **Step 1: Unit suites.** Run `npx jest "src/app/(keep)/dashboard" src/widgets/alerts-table "src/app/(keep)/alerts"`. Expected: all pass. Compare any failure against `origin/dev` before treating it as caused by this branch.
- [ ] **Step 2: Types and lint.** Run `npx tsc --noEmit -p . 2>&1 | sort > /tmp/atw-tsc.txt`, and the same on a clean `origin/dev` worktree. Expected: no new errors in files this branch touched. Run `npx eslint <changed files>`. Expected: no new errors.
- [ ] **Step 3: Live demo** (`/Users/yarin/keep-namespace/.worktrees/alert-table-widget-customization/demo`, UI http://localhost:3004, dashboard `atw widget customization demo`). In a browser:
  1. The "Follows preset columns" widget shows Description before Name, and "Alert" as the name header.
  2. The "Grouped by incident" widget shows "No incident" on top, "ATW Checkout degraded · Firing · 6 shown · 6 in incident" (or the seeded counts), and the two-incident group.
  3. Edit dashboard → ⚙ → set "Rows with no value" to Bottom → drag a header → resize Description → Save → reload. Everything persisted.
  4. Edit → change something → Cancel. Reverted.
  5. Narrow widget in edit mode: no header controls, ⚙ works.
  6. The presets page `/alerts/atw incidents` still groups, drags and sorts as before.
  Save screenshots to `demo/screenshots/`.
- [ ] **Step 4: Coordination.** Append a DONE line with the branch head SHA to the coordination file.
