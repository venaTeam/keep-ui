# Alert Table Widget Quick Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a dashboard Alert Table widget, open the presets page's Change Status, Dismiss and Associate-to-incident dialogs for one alert (a hover tray on the row) or for several (checkboxes plus a selection strip that replaces the count line).

**Architecture:** A new FSD feature `src/features/alerts/alert-quick-actions/` holds an action registry (three thin adapters over the existing dialogs), pure selection helpers, the tray, the strip and a dialog host. The widget panel owns the selection and the open dialog. It passes them into the widget table, which adds two chrome columns (a 28 px checkbox gutter and a zero-width row-actions column pinned right) and turns on TanStack row selection. The shared table body gets one new prop so the widget has checkboxes without drag-to-select. The presets page is unchanged.

**Tech Stack:** Next.js 15, React 19, TypeScript, TanStack Table v8, SWR, Tremor, Jest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-widget-quick-actions-design.md`

## Global Constraints

- Work only in `keep-ui`, on local branch `feat/widget-quick-actions` (stacked on PR #110's `feat/alert-table-widget-customization`). If #110 changes, merge it in, never rebase. Never push and never open a PR unless the user asks.
- No backend change. No change under `src/features/alerts/alert-change-status/`, `src/features/alerts/dismiss-alert/` or `src/features/alerts/alert-associate-to-incident/`.
- Presets page behaviour unchanged: every new prop on a shared component defaults to today's behaviour.
- Nothing new is visible at rest except an empty 28 px left gutter. Checkboxes and the tray appear on row hover or keyboard focus; once anything is ticked, every checkbox shows.
- Copy, exactly: `Change Status`, `Link to incident`, `Dismiss`, `Link {n} to incident`, `Dismiss {n}`, `{n} selected`, `Clear`.
- Icons: `ChevronDoubleRightIcon` and `LinkIcon` from `@heroicons/react/24/outline`; `IoNotificationsOffOutline` from `react-icons/io5`.
- No inline comments. Docstrings / JSDoc only.
- Commits: conventional (`feat(dashboard): …`, `test(dashboard): …`). No URLs and no Claude-Session trailer. End with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run commands from `keep-ui/`. Jest: `npx jest <path>`. Gates: `npm run typecheck`, `npm run lint`. A green `npm run build` proves nothing about types.

## Decisions this plan adds to the spec

- **Refresh:** the success handler calls `useRevalidateMultiple()(["/alerts/query", "/preset"])`. Prefix matching covers every widget's `useLastAlerts`, the count queries (`/alerts/query/count…`, count-by included) and the preset counters, so `usePresetAlertsCount` is not changed. Status and Dismiss already revalidate `/alert*` themselves; Associate does not.
- **"No live incident":** `/alerts/query` attaches every non-deleted link (`enrich_alerts_with_incidents`, gateway `src/repositories/db.py`), whatever the incident's state. The client counts a link only if `is_candidate !== true` and the incident's `status !== "deleted"`. `is_visible` is not in `IncidentDto`, so hidden incidents count as live. This is a known, accepted gap.
- **Group checkbox placement:** it stays where the shared group row draws it (right of the chevron), with the widget's hover-reveal class. It is not moved into the gutter.
- **Row-actions column id is `alertMenu`.** That is the presets page's ⋯ column id: already excluded from widget configs, already menu-less in `AlertsTableHeaders`, already pinned right on the presets page.
- **Chrome columns are not saved and not in the ⚙ panel.** They are added in `widget-alerts-table.tsx` outside `useWidgetColumnState`, and only when the panel passes `selection` and the dashboard is not in edit mode.
- **The strip replaces the "Alerts count" line, and "Go to preset" hides while anything is ticked** (as in the approved mock). The count-by lines above it stay.
- **A dialog keeps the alerts it opened with.** A poll that changes the list while the dialog is open does not change what it acts on.
- **Chrome column definitions live in a new `widget-quick-action-columns.tsx`, not in `use-widget-alert-columns.ts`.** That hook's output feeds grouping, the ⚙ panel and the saved config, none of which may see these columns.
- **Spec wording fix:** the spec calls "Link to incident" the presets page's bulk-tray wording. The bulk tray actually says "Associate with incident" and the row menu says "Correlate Incident". The approved mock's "Link to incident" stands.

## Review Focus

1. **A poll drops a ticked alert while its dialog is open.** The dialog still acts on the alerts it opened with; on success the selection clears. Covered by Task 6, `keeps the dialog's alerts when a refresh drops one`.
2. **Two Alert Table widgets on one dashboard.** Ticking in one leaves the other's count line and selection alone. Covered by Task 6, `keeps selections separate per widget`.
3. **Duplicate fingerprints in one response** (the body already de-duplicates render keys for this). Both rows tick together, the strip says `1 selected` and the dialog gets one alert. Covered by Task 6, `counts a duplicated fingerprint once`.
4. **A ticked alert gains an incident between polls.** The strip recomputes eligibility from fresh data: `Link to incident` becomes `Link {n-1} to incident`, or disappears. Covered by Task 6, `recomputes eligibility from refreshed alerts`.
5. **Esc inside an open dialog.** The dialog handles Esc; the selection survives. Covered by Task 6, `ignores Esc while a dialog is open`.

---

### Task 1: Selection and incident rules (feature model)

**Files:**
- Create: `src/features/alerts/alert-quick-actions/model/types.ts`
- Create: `src/features/alerts/alert-quick-actions/model/has-live-incident.ts`
- Create: `src/features/alerts/alert-quick-actions/model/selection.ts`
- Create: `src/features/alerts/alert-quick-actions/model/use-refresh-alert-queries.ts`
- Test: `src/features/alerts/alert-quick-actions/model/__tests__/has-live-incident.test.ts`
- Test: `src/features/alerts/alert-quick-actions/model/__tests__/selection.test.ts`
- Test: `src/features/alerts/alert-quick-actions/model/__tests__/use-refresh-alert-queries.test.ts`

**Interfaces:**
- Produces (`model/types.ts`):
  ```ts
  export interface QuickActionDialogProps {
    alerts: AlertDto[];
    presetName: string;
    onClose: () => void;
    onSuccess: () => void;
  }
  export interface WidgetAlertAction {
    id: string;
    label: string;
    icon: ElementType;
    appliesTo: (alert: AlertDto) => boolean;
    bulk: boolean;
    partialLabel: (count: number) => string;
    Dialog: ComponentType<QuickActionDialogProps>;
  }
  export interface OpenQuickAction {
    actionId: string;
    alerts: AlertDto[];
  }
  ```
- Produces: `hasLiveIncident(alert: AlertDto): boolean`
- Produces: `pruneSelection(selection: RowSelectionState, shownIds: readonly string[]): RowSelectionState`. It returns the same object when nothing is dropped, so `setState(prev => pruneSelection(prev, ids))` never loops.
- Produces: `getRangeIds(orderedIds: readonly string[], fromId: string, toId: string): string[]`
- Produces: `getEligibleAlerts(action: WidgetAlertAction, alerts: readonly AlertDto[]): AlertDto[]`
- Produces: `getStripLabel(action: WidgetAlertAction, eligibleCount: number, selectedCount: number): string`
- Produces: `useRefreshAlertQueries(): () => void`

- [ ] **Step 1: Write the failing tests**

`has-live-incident.test.ts`. Import `Status as IncidentStatus` from `@/entities/incidents/model`:
```ts
it("is false with no incident_dto", () => expect(hasLiveIncident(alert({}))).toBe(false));
it("is false with an empty list", () => expect(hasLiveIncident(alert({ incident_dto: [] }))).toBe(false));
it("is true for a confirmed, open incident", () =>
  expect(hasLiveIncident(alert({ incident_dto: [{ id: "i1", is_candidate: false, status: IncidentStatus.Firing }] }))).toBe(true));
it("ignores candidate incidents", () =>
  expect(hasLiveIncident(alert({ incident_dto: [{ id: "i1", is_candidate: true, status: IncidentStatus.Firing }] }))).toBe(false));
it("ignores deleted incidents", () =>
  expect(hasLiveIncident(alert({ incident_dto: [{ id: "i1", is_candidate: false, status: IncidentStatus.Deleted }] }))).toBe(false));
it("is true when any one link is live", () =>
  expect(hasLiveIncident(alert({ incident_dto: [
    { id: "i1", is_candidate: true, status: IncidentStatus.Firing },
    { id: "i2", is_candidate: false, status: IncidentStatus.Resolved },
  ] }))).toBe(true));
```

`selection.test.ts`:
```ts
describe("pruneSelection", () => {
  it("returns the same object when every key is shown", () => {
    const s = { a: true, b: true };
    expect(pruneSelection(s, ["a", "b", "c"])).toBe(s);
  });
  it("drops keys that are not shown", () =>
    expect(pruneSelection({ a: true, b: true }, ["b"])).toEqual({ b: true }));
  it("drops everything for an empty list", () =>
    expect(pruneSelection({ a: true }, [])).toEqual({}));
});
describe("getRangeIds", () => {
  const order = ["a", "b", "c", "d"];
  it("is inclusive forwards", () => expect(getRangeIds(order, "b", "d")).toEqual(["b", "c", "d"]));
  it("is inclusive backwards, in display order", () => expect(getRangeIds(order, "d", "b")).toEqual(["b", "c", "d"]));
  it("is just the target when the anchor is gone", () => expect(getRangeIds(order, "x", "c")).toEqual(["c"]));
});
describe("getStripLabel", () => {
  const link = { label: "Link to incident", partialLabel: (n: number) => `Link ${n} to incident` } as WidgetAlertAction;
  it("uses the plain label when every ticked alert goes in", () => expect(getStripLabel(link, 4, 4)).toBe("Link to incident"));
  it("counts when some are left out", () => expect(getStripLabel(link, 3, 4)).toBe("Link 3 to incident"));
});
describe("getEligibleAlerts", () => {
  it("keeps only alerts the action applies to, in order", () => {
    const action = { appliesTo: (a: AlertDto) => a.status === "firing" } as WidgetAlertAction;
    const [x, y, z] = [alert({ fingerprint: "x", status: "firing" }), alert({ fingerprint: "y", status: "resolved" }), alert({ fingerprint: "z", status: "firing" })];
    expect(getEligibleAlerts(action, [x, y, z])).toEqual([x, z]);
  });
});
```

`use-refresh-alert-queries.test.ts`: mock `@/shared/lib/state-utils` so `useRevalidateMultiple` returns `mockRevalidate`. Then:
```ts
it("revalidates every alert query and the presets", () => {
  const { result } = renderHook(() => useRefreshAlertQueries());
  result.current();
  expect(mockRevalidate).toHaveBeenCalledWith(["/alerts/query", "/preset"]);
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx jest src/features/alerts/alert-quick-actions/model`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the four model files**

`hasLiveIncident` reads `alert.incident_dto ?? []`. `useRefreshAlertQueries` wraps `useRevalidateMultiple` from `@/shared/lib/state-utils` in a `useCallback`. Each exported function gets a one-line JSDoc. `hasLiveIncident`'s JSDoc names the rule and the `is_visible` gap.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/features/alerts/alert-quick-actions/model`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/alerts/alert-quick-actions/model
git commit -m "feat(dashboard): selection and incident rules for widget quick actions"
```

---

### Task 2: Action registry and dialog adapters

**Files:**
- Create: `src/features/alerts/alert-quick-actions/ui/action-dialogs.tsx`
- Create: `src/features/alerts/alert-quick-actions/model/actions.ts`
- Test: `src/features/alerts/alert-quick-actions/model/__tests__/actions.test.tsx`

**Interfaces:**
- Consumes: `WidgetAlertAction`, `QuickActionDialogProps`, `hasLiveIncident` (Task 1).
- Produces: `ChangeStatusDialog`, `DismissDialog`, `LinkIncidentDialog`, each `(props: QuickActionDialogProps) => JSX.Element`.
- Produces: `ALERT_QUICK_ACTIONS: readonly WidgetAlertAction[]` in screen order, with ids `"change-status"`, `"link-incident"` and `"dismiss"`. Also `getQuickAction(id: string): WidgetAlertAction | undefined`.

| id | label | partialLabel(n) | icon | appliesTo | bulk | Dialog |
|---|---|---|---|---|---|---|
| `change-status` | `Change Status` | `Change Status` | ChevronDoubleRightIcon | always true | true | ChangeStatusDialog |
| `link-incident` | `Link to incident` | `Link {n} to incident` | LinkIcon | `!hasLiveIncident(alert)` | true | LinkIncidentDialog |
| `dismiss` | `Dismiss` | `Dismiss {n}` | IoNotificationsOffOutline | `alert.status !== Status.Suppressed` | true | DismissDialog |

- [ ] **Step 1: Write the failing tests**

Mock the three dialog barrels (`@/features/alerts/alert-change-status`, `@/features/alerts/dismiss-alert`, `@/features/alerts/alert-associate-to-incident`). Each mock records its props in a `jest.fn()` and renders `null`.
```ts
it("lists the actions in screen order", () =>
  expect(ALERT_QUICK_ACTIONS.map((a) => a.id)).toEqual(["change-status", "link-incident", "dismiss"]));
it("offers Change Status for every alert", () =>
  expect(getQuickAction("change-status")!.appliesTo(alert({ status: Status.Suppressed }))).toBe(true));
it("offers Link only without a live incident", () => {
  const link = getQuickAction("link-incident")!;
  expect(link.appliesTo(alert({}))).toBe(true);
  expect(link.appliesTo(alert({ incident_dto: [{ id: "i", is_candidate: false, status: "firing" }] }))).toBe(false);
});
it("hides Dismiss for suppressed alerts", () =>
  expect(getQuickAction("dismiss")!.appliesTo(alert({ status: Status.Suppressed }))).toBe(false));
it("opens Change Status with the single alert, not an array", () => {
  render(<ChangeStatusDialog alerts={[a1]} presetName="feed" onClose={close} onSuccess={ok} />);
  expect(mockChangeStatus).toHaveBeenLastCalledWith(expect.objectContaining({ alert: a1, presetName: "feed", handleClose: close, onSuccess: ok }), expect.anything());
});
it("opens Change Status in batch mode for several alerts", () => {
  render(<ChangeStatusDialog alerts={[a1, a2]} presetName="feed" onClose={close} onSuccess={ok} />);
  expect(mockChangeStatus.mock.lastCall[0].alert).toEqual([a1, a2]);
});
it("opens Dismiss with an array and the preset", () => {
  render(<DismissDialog alerts={[a1]} presetName="feed" onClose={close} onSuccess={ok} />);
  expect(mockDismiss).toHaveBeenLastCalledWith(expect.objectContaining({ alert: [a1], preset: "feed", handleClose: close, onSuccess: ok }), expect.anything());
});
it("opens Associate already open, with success wired to handleSuccess", () => {
  render(<LinkIncidentDialog alerts={[a1, a2]} presetName="feed" onClose={close} onSuccess={ok} />);
  expect(mockAssociate).toHaveBeenLastCalledWith(expect.objectContaining({ isOpen: true, alerts: [a1, a2], handleSuccess: ok, handleClose: close }), expect.anything());
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx jest src/features/alerts/alert-quick-actions/model/__tests__/actions.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the adapters and the registry**

Each adapter renders its dialog from the feature's barrel, with the props shown in the tests and nothing else.

- [ ] **Step 4: Run and confirm pass**

Run: `npx jest src/features/alerts/alert-quick-actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/alerts/alert-quick-actions
git commit -m "feat(dashboard): quick action registry over the presets dialogs"
```

---

### Task 3: Tray, selection strip, dialog host, styles, barrel

**Files:**
- Create: `src/features/alerts/alert-quick-actions/ui/quick-actions.css`
- Create: `src/features/alerts/alert-quick-actions/ui/class-names.ts`
- Create: `src/features/alerts/alert-quick-actions/ui/quick-action-tray.tsx`
- Create: `src/features/alerts/alert-quick-actions/ui/selection-strip.tsx`
- Create: `src/features/alerts/alert-quick-actions/ui/quick-action-dialog-host.tsx`
- Create: `src/features/alerts/alert-quick-actions/index.ts`
- Test: `src/features/alerts/alert-quick-actions/ui/__tests__/quick-action-tray.test.tsx`
- Test: `src/features/alerts/alert-quick-actions/ui/__tests__/selection-strip.test.tsx`
- Test: `src/features/alerts/alert-quick-actions/ui/__tests__/quick-action-dialog-host.test.tsx`

**Interfaces:**
- Consumes: `ALERT_QUICK_ACTIONS`, `getQuickAction` (Task 2); `getEligibleAlerts`, `getStripLabel`, `OpenQuickAction` (Task 1).
- Produces (`class-names.ts`, which also does `import "./quick-actions.css"`): `QUICK_ACTIONS_TABLE_CLASS = "quick-actions-table"`, `QUICK_REVEAL_CLASS = "quick-reveal"`, `QUICK_PICK_CLASS = "quick-pick"`, `QUICK_TRAY_CLASS = "quick-tray"`, `QUICK_OPEN_ATTR = "data-quick-open"`.
- Produces: `QuickActionTray({ alert, compact, onOpen }: { alert: AlertDto; compact?: boolean; onOpen: (actionId: string, alerts: AlertDto[]) => void })`
- Produces: `SelectionStrip({ alerts, onOpen, onClear }: { alerts: AlertDto[]; onOpen: (actionId: string, alerts: AlertDto[]) => void; onClear: () => void })`
- Produces: `QuickActionDialogHost({ open, presetName, onClose, onSuccess }: { open: OpenQuickAction | null; presetName: string; onClose: () => void; onSuccess: () => void })`
- Produces (`index.ts`): the three components, `useRefreshAlertQueries`, `pruneSelection`, `getRangeIds`, the class-name constants, `ALERT_QUICK_ACTIONS`, and the types `OpenQuickAction`, `WidgetAlertAction`, `QuickActionDialogProps`.

`quick-actions.css` rules, all scoped under `.quick-actions-table`:
- `.quick-reveal` starts at `opacity: 0` with a `0.12s` opacity transition.
- It goes to `opacity: 1` under `tr:hover`, under `tr:focus-within`, on itself with `:focus-visible`, and under `.quick-actions-table[data-selecting]`.
- `.quick-tray` starts at `opacity: 0; pointer-events: none`. It goes to `opacity: 1; pointer-events: auto` under `tr:hover` and `tr:focus-within`.
- `tr:has(.quick-pick:checked) > td` and `tr:has([data-quick-open]) > td` get `background: #fff7ed` (Tailwind orange-50). The selector out-ranks the widget's opaque-sticky-cell rule.

The tray is `absolute right-1 top-1/2 -translate-y-1/2 z-20 flex gap-0.5 rounded-md border bg-white p-0.5 shadow-sm`. Each button is `type="button"` with `aria-label="{label}: {alert.name}"`, `data-cy="widget-quick-action-{id}"` and `onClick` that calls `stopPropagation` and then `onOpen(id, [alert])`. When `compact`, a button shows the icon only, with `title={label}`.

The strip sits in the count line's slot: `flex flex-wrap items-center gap-x-1.5 min-h-6 rounded border border-orange-200 bg-orange-50 px-2 text-xs`, with `data-cy="widget-selection-strip"`. It shows `{n} selected`, a divider, one button per bulk action with at least one eligible alert (`data-cy="widget-selection-action-{id}"`, label from `getStripLabel`, opening with the eligible alerts), and `Clear` (`data-cy="widget-selection-clear"`) at the end.

- [ ] **Step 1: Write the failing tests**

Tray:
```ts
it("shows all three for a firing alert with no incident", () => {
  render(<QuickActionTray alert={firingNoIncident} onOpen={onOpen} />);
  expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Change Status", "Link to incident", "Dismiss"]);
});
it("hides Link for an alert in a live incident", () => {
  render(<QuickActionTray alert={inIncident} onOpen={onOpen} />);
  expect(screen.queryByRole("button", { name: /Link to incident/ })).toBeNull();
});
it("hides Dismiss for a suppressed alert", () => {
  render(<QuickActionTray alert={suppressed} onOpen={onOpen} />);
  expect(screen.queryByRole("button", { name: /^Dismiss/ })).toBeNull();
});
it("opens the action for that one alert without reaching the row", () => {
  const rowClick = jest.fn();
  render(<div onClick={rowClick}><QuickActionTray alert={firingNoIncident} onOpen={onOpen} /></div>);
  fireEvent.click(screen.getByRole("button", { name: `Dismiss: ${firingNoIncident.name}` }));
  expect(onOpen).toHaveBeenCalledWith("dismiss", [firingNoIncident]);
  expect(rowClick).not.toHaveBeenCalled();
});
it("shows icons only when compact, keeping accessible names", () => {
  render(<QuickActionTray alert={firingNoIncident} compact onOpen={onOpen} />);
  expect(screen.getByRole("button", { name: `Change Status: ${firingNoIncident.name}` }).textContent).toBe("");
});
```

Strip:
```ts
it("counts the selection", () => {
  render(<SelectionStrip alerts={[a, b, c, d]} onOpen={onOpen} onClear={onClear} />);
  expect(screen.getByText("4 selected")).toBeInTheDocument();
});
it("says how many go in when some are skipped, and opens with only those", () => {
  render(<SelectionStrip alerts={[noInc1, noInc2, noInc3, inIncident]} onOpen={onOpen} onClear={onClear} />);
  fireEvent.click(screen.getByRole("button", { name: "Link 3 to incident" }));
  expect(onOpen).toHaveBeenCalledWith("link-incident", [noInc1, noInc2, noInc3]);
});
it("hides an action no ticked alert qualifies for", () => {
  render(<SelectionStrip alerts={[suppressed]} onOpen={onOpen} onClear={onClear} />);
  expect(screen.queryByRole("button", { name: /Dismiss/ })).toBeNull();
});
it("clears", () => {
  render(<SelectionStrip alerts={[a]} onOpen={onOpen} onClear={onClear} />);
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(onClear).toHaveBeenCalled();
});
```

Host. Mock `../action-dialogs` so each adapter renders `<div data-testid={name} />` and records its props:
```ts
it("renders nothing when closed", () => {
  const { container } = render(<QuickActionDialogHost open={null} presetName="feed" onClose={close} onSuccess={ok} />);
  expect(container).toBeEmptyDOMElement();
});
it("renders the open action's dialog with its alerts and callbacks", () => {
  render(<QuickActionDialogHost open={{ actionId: "dismiss", alerts: [a] }} presetName="feed" onClose={close} onSuccess={ok} />);
  expect(mockDismissDialog).toHaveBeenLastCalledWith(expect.objectContaining({ alerts: [a], presetName: "feed", onClose: close, onSuccess: ok }), expect.anything());
});
it("renders nothing for an unknown action id", () => {
  const { container } = render(<QuickActionDialogHost open={{ actionId: "nope", alerts: [a] }} presetName="feed" onClose={close} onSuccess={ok} />);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx jest src/features/alerts/alert-quick-actions/ui`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the CSS, class names, three components and the barrel**

- [ ] **Step 4: Run and confirm pass**

Run: `npx jest src/features/alerts/alert-quick-actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/alerts/alert-quick-actions
git commit -m "feat(dashboard): quick action tray, selection strip and dialog host"
```

---

### Task 4: Shared table: checkboxes without drag-select, styleable group checkbox

**Files:**
- Modify: `src/widgets/alerts-table/ui/alerts-table-body.tsx` (props at 23-55, the two `if (!selectable)` branches at 306 and 335, `GroupedRow` props at 191-207)
- Modify: `src/widgets/alerts-table/ui/alert-grouped-row.tsx` (props at 22-37 and 90-105, checkbox at 175-183)
- Test: `src/widgets/alerts-table/ui/__tests__/alert-grouped-row.test.tsx` (extend)
- Test: `src/widgets/alerts-table/ui/__tests__/alerts-table-body.test.tsx` (new; mock `react-selectable-fast` the way `alert-grouped-row.test.tsx` does)

**Interfaces:**
- Produces: `AlertsTableBody` gains `dragSelectable?: boolean` (default: the value of `selectable`) and `groupCheckboxClassName?: string`.
  - `dragSelectable` alone decides whether rows render as `SelectableRow` inside `SelectableGroup`.
  - `selectable` still decides whether group rows show their checkbox.
- Produces: `GroupedRow` gains `checkboxClassName?: string`, passed to `TableIndeterminateCheckbox` as `className`.

- [ ] **Step 1: Write the failing tests**

```ts
it("wraps rows in the drag-select group by default when selectable", () => {
  renderBody({ selectable: true });
  expect(mockSelectableGroup).toHaveBeenCalled();
});
it("renders plain rows with selectable but dragSelectable false", () => {
  renderBody({ selectable: true, dragSelectable: false });
  expect(mockSelectableGroup).not.toHaveBeenCalled();
  expect(screen.getAllByRole("row").length).toBeGreaterThan(0);
});
it("still shows group checkboxes with dragSelectable false", () => {
  renderBody({ selectable: true, dragSelectable: false, grouped: true, withCheckboxColumn: true });
  const header = document.querySelector('[data-cy="alerts-group-header"]') as HTMLElement;
  expect(within(header).getByRole("checkbox")).toBeInTheDocument();
});
```

In `alert-grouped-row.test.tsx`:
```ts
it("puts checkboxClassName on the group checkbox", () => {
  renderGroupedRow({ selectable: true, withCheckboxColumn: true, checkboxClassName: "quick-reveal" });
  expect(within(groupHeader()).getByRole("checkbox")).toHaveClass("quick-reveal");
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx jest src/widgets/alerts-table/ui/__tests__/alerts-table-body.test.tsx src/widgets/alerts-table/ui/__tests__/alert-grouped-row.test.tsx`
Expected: the new tests FAIL; existing grouped-row tests still PASS.

- [ ] **Step 3: Implement both props**

Compute `const dragSelect = dragSelectable ?? selectable;` and use it in both `if (!selectable)` branches. Leave `selectable={selectable}` on `GroupedRow` and add `checkboxClassName={groupCheckboxClassName}`. Update the JSDoc on `AlertsTableBody`'s props.

- [ ] **Step 4: Run and confirm pass, including the presets page's table suites**

Run: `npx jest src/widgets/alerts-table`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/alerts-table/ui
git commit -m "feat(alerts-table): checkboxes without drag-select and a styleable group checkbox"
```

---

### Task 5: Widget table: checkbox gutter, row tray, selection

**Files:**
- Create: `src/app/(keep)/dashboard/widget-types/preset/widget-row-actions-context.tsx`
- Create: `src/app/(keep)/dashboard/widget-types/preset/widget-quick-action-columns.tsx`
- Modify: `src/app/(keep)/dashboard/widget-types/preset/widget-alerts-table.tsx` (props 49-56; table setup 182-255; wrapper 314-371; JSDoc 388-413)
- Test: `src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-alerts-table.test.tsx` (extend)

**Interfaces:**
- Consumes: `QuickActionTray`, `getRangeIds`, `QUICK_*` class names (Tasks 1 and 3); `dragSelectable` and `groupCheckboxClassName` (Task 4).
- Produces (`widget-alerts-table.tsx`):
  ```ts
  export interface WidgetSelectionProps {
    rowSelection: RowSelectionState;
    onRowSelectionChange: (next: RowSelectionState) => void;
    onOpenAction: (actionId: string, alerts: AlertDto[]) => void;
    openFingerprint: string | null;
  }
  ```
  `WidgetAlertsTableProps` gains `selection?: WidgetSelectionProps`.
- Produces (`widget-row-actions-context.tsx`):
  ```ts
  export interface WidgetRowActions {
    isSelecting: boolean;
    compact: boolean;
    openFingerprint: string | null;
    onPick: (rowId: string, shiftKey: boolean) => void;
    onOpenAction: (actionId: string, alerts: AlertDto[]) => void;
  }
  export const WidgetRowActionsContext: React.Context<WidgetRowActions | null>;
  ```
- Produces (`widget-quick-action-columns.tsx`):
  - `CHECKBOX_COLUMN_ID = "checkbox"`, `ROW_ACTIONS_COLUMN_ID = "alertMenu"`, `CHECKBOX_COLUMN_PX = 28`.
  - `QUICK_ACTION_COLUMNS: { checkbox: ColumnDef<AlertDto>; rowActions: ColumnDef<AlertDto> }`.
  - Checkbox column:
    - Size, minSize and maxSize are all 28. Meta td/th class is `!p-0 !w-7`.
    - Header: `TableIndeterminateCheckbox` with `className={QUICK_REVEAL_CLASS}`, `aria-label="Select all shown alerts"` and the table's all-rows handlers.
    - Cell: an `<input type="checkbox">` with classes `QUICK_REVEAL_CLASS` and `QUICK_PICK_CLASS` and `aria-label="Select {name}"`. `onChange` calls `onPick(row.id, (e.nativeEvent as MouseEvent).shiftKey === true)`.
    - When `openFingerprint === row.original.fingerprint`, the cell also renders `<span data-quick-open hidden />`.
  - Row-actions column:
    - Size, minSize and maxSize are all 0. Meta td class `!p-0 !w-0 overflow-visible`, th class `!p-0 !w-0`.
    - Empty header. The cell renders `QuickActionTray` with `compact` from context, unless `isSelecting`.

Behaviour to build:
- Chrome is on when `selection && !isEditMode`.
- With chrome on, the table gets:
  - columns `[checkbox, ...layoutColumns, rowActions]`;
  - columnOrder `["checkbox", ...state.columnOrder, "alertMenu"]`;
  - columnVisibility `{ ...state.columnVisibility, checkbox: true, alertMenu: true }`;
  - pinning `{ left: ["checkbox", ...pinnedLeft], right: ["alertMenu"] }`;
  - `enableRowSelection: (row) => !row.getIsGrouped()`;
  - `state.rowSelection = selection.rowSelection`;
  - `onRowSelectionChange` that resolves an updater function against `selection.rowSelection` before calling `selection.onRowSelectionChange`.
- With chrome off, everything is as today and `enableRowSelection: false`.
- Layout: call `getWidgetColumnLayout` with `containerWidth - borderWidth - (chrome ? CHECKBOX_COLUMN_PX : 0)`. Then render with `columnSizing: { ...layout.columnSizing, checkbox: 28, alertMenu: 0 }` and `tableWidth + 28`. The ⚙ panel's `getColumnWidths` is unaffected because chrome is off in edit mode.
- `onPick(rowId, shift)`:
  - The display order is the leaf rows of `table.getRowModel().rows`, with grouped rows expanded to their `subRows` only when `groupExpansion.isGroupExpanded(row.id)`.
  - If `shift` is set and `lastPickRef.current` is in that order, set every id in `getRangeIds(order, last, rowId)` to the opposite of `rowId`'s current state. Otherwise toggle `rowId` alone.
  - Then set `lastPickRef.current = rowId` and call `selection.onRowSelectionChange` with a new object that has no `false` values.
- Wrapper `div`: add `QUICK_ACTIONS_TABLE_CLASS` when chrome is on, and `data-selecting=""` while any key is in `rowSelection`.
- `AlertsTableBody`: `selectable={chrome}`, `dragSelectable={false}`, `groupCheckboxClassName={QUICK_REVEAL_CLASS}`.
- The context provider wraps `<Table>`, with `compact: isNarrow`.

- [ ] **Step 1: Write the failing tests**

Use a harness that holds `rowSelection` in `useState` and passes `selection`. Spy on `onOpenAction`.
```ts
it("adds no gutter, tray or row selection without selection props", () => {
  render(<WidgetAlertsTable item={baseItem} alerts={[a1]} isEditMode={false} />);
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(document.querySelector('[data-column-id="alertMenu"]')).toBeNull();
});
it("adds nothing actionable in edit mode even with selection props", () => {
  renderHarness({ isEditMode: true });
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Dismiss:/ })).toBeNull();
});
it("renders a row checkbox and the row's tray", () => {
  renderHarness({ alerts: [a1] });
  expect(screen.getByRole("checkbox", { name: `Select ${a1.name}` })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: `Change Status: ${a1.name}` })).toBeInTheDocument();
});
it("opens an action for one row from its tray", () => {
  renderHarness({ alerts: [a1] });
  fireEvent.click(screen.getByRole("button", { name: `Dismiss: ${a1.name}` }));
  expect(onOpenAction).toHaveBeenCalledWith("dismiss", [a1]);
});
it("ticks a row by fingerprint and hides every tray while selecting", () => {
  renderHarness({ alerts: [a1, a2] });
  fireEvent.click(screen.getByRole("checkbox", { name: `Select ${a1.name}` }));
  expect(lastSelection()).toEqual({ [a1.fingerprint]: true });
  expect(screen.queryByRole("button", { name: /^Change Status:/ })).toBeNull();
  expect(document.querySelector('[data-cy="dashboard-widget-alerts-table"]')).toHaveAttribute("data-selecting");
});
it("selects all shown rows from the header", () => {
  renderHarness({ alerts: [a1, a2, a3] });
  fireEvent.click(screen.getByRole("checkbox", { name: "Select all shown alerts" }));
  expect(Object.keys(lastSelection()).sort()).toEqual([a1, a2, a3].map((a) => a.fingerprint).sort());
});
it("shift-click ticks the range in display order across groups", () => {
  renderHarness({ alerts: [noInc1, noInc2, inInc1, inInc2], groupBy: "incident" });
  fireEvent.click(checkboxFor(noInc1));
  fireEvent.click(checkboxFor(inInc1), { shiftKey: true });
  expect(Object.keys(lastSelection()).sort()).toEqual([noInc1, noInc2, inInc1].map((a) => a.fingerprint).sort());
});
it("shift-click skips rows of a collapsed group", () => { /* collapse the middle group, then range across it */ });
it("ticks every row of a group from its header checkbox, also when collapsed", () => {
  renderHarness({ alerts: [noInc1, noInc2, inInc1], groupBy: "incident" });
  const header = groupHeaderFor("No incident");
  fireEvent.click(header);
  fireEvent.click(within(header).getByRole("checkbox"));
  expect(Object.keys(lastSelection()).sort()).toEqual([noInc1, noInc2].map((a) => a.fingerprint).sort());
});
it("shows the group checkbox as some-selected when part of the group is ticked", () => {
  renderHarness({ alerts: [noInc1, noInc2], groupBy: "incident", initial: { [noInc1.fingerprint]: true } });
  expect((within(groupHeaderFor("No incident")).getByRole("checkbox") as HTMLInputElement).indeterminate).toBe(true);
});
it("marks the row whose dialog is open", () => {
  renderHarness({ alerts: [a1], openFingerprint: a1.fingerprint });
  expect(rowFor(a1).querySelector("[data-quick-open]")).not.toBeNull();
});
it("does not save chrome columns or show them in the ⚙ panel", () => {
  /* edit mode with onChange: chrome off, settings column list unchanged (assert against allColumnIds as existing tests do) */
});
it("keeps the table exactly as wide as the widget with the gutter", () => {
  /* reuse the existing ResizeObserver width stub: width W -> table style width W */
});
```
Reuse the file's `alertWith`, `linkedAlert` and `unlinkedAlert` fixtures and the existing ResizeObserver stub. Group header helpers select `[data-cy="alerts-group-header"]` by text.

- [ ] **Step 2: Run and confirm failure**

Run: `npx jest "src/app/(keep)/dashboard/widget-types/preset/__tests__/widget-alerts-table.test.tsx"`
Expected: the new tests FAIL; existing ones PASS.

- [ ] **Step 3: Implement the context, the columns and the wiring**

Update `WidgetAlertsTable`'s JSDoc with one paragraph on selection: when it is on, what is pinned, and that it is off in edit mode.

- [ ] **Step 4: Run and confirm pass**

Run: `npx jest "src/app/(keep)/dashboard/widget-types/preset"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(keep)/dashboard/widget-types/preset"
git commit -m "feat(dashboard): checkbox gutter, row tray and selection in the alert table widget"
```

---

### Task 6: Widget panel: selection state, strip, dialogs, refresh

**Files:**
- Modify: `src/app/(keep)/dashboard/widget-types/preset/preset-alert-table-panel.tsx` (state near 64-80, count line 254-275, table props 276-289)
- Test: `src/app/(keep)/dashboard/widget-types/preset/__tests__/preset-alert-table-panel.test.tsx` (extend)

**Interfaces:**
- Consumes: `WidgetSelectionProps` (Task 5); `SelectionStrip`, `QuickActionDialogHost`, `useRefreshAlertQueries`, `pruneSelection`, `OpenQuickAction` (Tasks 1 and 3).

Behaviour to build:
- State: `rowSelection: RowSelectionState` (initially `{}`) and `openAction: OpenQuickAction | null`.
- `shownAlerts = isLoading ? undefined : alerts`. When `shownAlerts` changes and is defined, run `setRowSelection((prev) => pruneSelection(prev, fingerprints))`. While it is undefined, never prune.
- `selectedAlerts`: the members of `shownAlerts` whose fingerprint is in `rowSelection`, de-duplicated by fingerprint (`uniqBy` from lodash).
- When `isEditMode` becomes true, run `setRowSelection({})` and `setOpenAction(null)`.
- While `selectedAlerts.length > 0 && !openAction`, a `document` `keydown` listener clears the selection on `Escape`.
- `handleSuccess` sets `openAction` to null, clears `rowSelection` and calls `refresh()`. `handleClose` only sets `openAction` to null.
- The count line renders `<SelectionStrip …>` instead of `renderAlertsCountText()` while anything is selected, and `Go to preset` is not rendered then.
- `WidgetAlertsTable` gets `selection` only when `!isEditMode && !!preset`. That object is `{ rowSelection, onRowSelectionChange: setRowSelection, onOpenAction: (actionId, alerts) => setOpenAction({ actionId, alerts }), openFingerprint }`, where `openFingerprint` is the fingerprint when `openAction` holds exactly one alert, else `null`.
- Render `<QuickActionDialogHost open={openAction} presetName={preset?.name ?? ""} onClose={handleClose} onSuccess={handleSuccess} />` after the table.

- [ ] **Step 1: Write the failing tests**

Extend the existing mocks:
- Partially mock `@/features/alerts/alert-quick-actions` so `QuickActionDialogHost` records its props in `mockHostProps` and renders null.
- Mock `useRefreshAlertQueries` to return `mockRefresh`. `SelectionStrip` stays real.
- Drive selection through the captured `mockLastTableProps.selection.onRowSelectionChange` inside `act`.
```ts
it("passes selection props in view mode only", () => {
  renderInMode(false);
  expect(mockLastTableProps!.selection).toEqual(expect.objectContaining({ rowSelection: {} }));
  renderInMode(true, { onSave: jest.fn() });
  expect(mockLastTableProps!.selection).toBeUndefined();
});
it("swaps the count line for the strip while anything is ticked", () => {
  renderWithAlerts([a1, a2]);
  tick({ [a1.fingerprint]: true });
  expect(document.querySelector('[data-cy="widget-selection-strip"]')).not.toBeNull();
  expect(screen.queryByText(/Alerts count:/)).toBeNull();
  expect(document.querySelector('[data-cy="dashboard-widget-preset-go-to-btn"]')).toBeNull();
});
it("drops ticked alerts that a refresh removes", () => {
  const { rerender } = renderWithAlerts([a1, a2]);
  tick({ [a1.fingerprint]: true, [a2.fingerprint]: true });
  rerenderWithAlerts(rerender, [a2]);
  expect(screen.getByText("1 selected")).toBeInTheDocument();
});
it("keeps the selection through a loading state", () => { /* isLoading true then false with the same alerts: still "1 selected" */ });
it("opens the dialog with the strip's eligible alerts", () => {
  renderWithAlerts([noInc, inInc]);
  tick({ [noInc.fingerprint]: true, [inInc.fingerprint]: true });
  fireEvent.click(screen.getByRole("button", { name: "Link 1 to incident" }));
  expect(mockHostProps.open).toEqual({ actionId: "link-incident", alerts: [noInc] });
  expect(mockHostProps.presetName).toBe("feed");
});
it("keeps the selection when the dialog is cancelled", () => {
  openFromStrip("dismiss");
  act(() => mockHostProps.onClose());
  expect(mockHostProps.open).toBeNull();
  expect(screen.getByText("2 selected")).toBeInTheDocument();
});
it("clears the selection and refreshes on success", () => {
  openFromStrip("dismiss");
  act(() => mockHostProps.onSuccess());
  expect(mockHostProps.open).toBeNull();
  expect(screen.queryByText(/selected/)).toBeNull();
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});
it("clears the selection on Esc", () => {
  renderWithAlerts([a1]); tick({ [a1.fingerprint]: true });
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByText(/selected/)).toBeNull();
});
it("ignores Esc while a dialog is open", () => {
  openFromStrip("change-status");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByText("2 selected")).toBeInTheDocument();
});
it("clears selection and closes the dialog on entering edit mode", () => { /* rerender inside DashboardEditModeProvider value=true */ });
it("marks the single alert whose dialog is open", () => {
  renderWithAlerts([a1]);
  act(() => (mockLastTableProps!.selection as WidgetSelectionProps).onOpenAction("dismiss", [a1]));
  expect((mockLastTableProps!.selection as WidgetSelectionProps).openFingerprint).toBe(a1.fingerprint);
});
it("keeps the dialog's alerts when a refresh drops one", () => {
  openFromStrip("dismiss");
  rerenderWithAlerts(rerender, [a2]);
  expect(mockHostProps.open!.alerts).toEqual([a1, a2]);
});
it("keeps selections separate per widget", () => { /* two panels with distinct mockLastTableProps captures; tick in the first; the second still shows "Alerts count:" */ });
it("counts a duplicated fingerprint once", () => {
  renderWithAlerts([a1, { ...a1 }]);
  tick({ [a1.fingerprint]: true });
  expect(screen.getByText("1 selected")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(mockHostProps.open!.alerts).toHaveLength(1);
});
it("recomputes eligibility from refreshed alerts", () => {
  const { rerender } = renderWithAlerts([noInc1, noInc2]);
  tick({ [noInc1.fingerprint]: true, [noInc2.fingerprint]: true });
  rerenderWithAlerts(rerender, [withIncident(noInc1), noInc2]);
  expect(screen.getByRole("button", { name: "Link 1 to incident" })).toBeInTheDocument();
});
```
`mockLastTableProps` is per render. For the two-widget test, capture props into an array keyed by `item.i`.

- [ ] **Step 2: Run and confirm failure**

Run: `npx jest "src/app/(keep)/dashboard/widget-types/preset/__tests__/preset-alert-table-panel.test.tsx"`
Expected: the new tests FAIL; existing ones PASS.

- [ ] **Step 3: Implement the panel changes**

- [ ] **Step 4: Run and confirm pass**

Run: `npx jest "src/app/(keep)/dashboard/widget-types/preset"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(keep)/dashboard/widget-types/preset"
git commit -m "feat(dashboard): selection strip and presets dialogs in the alert table widget"
```

---

### Task 7: Gates and browser check

Execution goes to subagents (user rule): suites and gates run on a **sonnet** test-runner, and the browser check on a **sonnet** browser agent. Judgment on failures stays in the main session.

- [ ] **Step 1: Dialog folders untouched**

Run: `git diff --quiet $(git merge-base HEAD feat/alert-table-widget-customization) HEAD -- src/features/alerts/alert-change-status src/features/alerts/dismiss-alert src/features/alerts/alert-associate-to-incident; echo $?`
Expected: `0`. Do not read this from an `rtk`-rewritten `git diff --stat`.

- [ ] **Step 2: Type and lint gates**

Run: `npm run typecheck && npm run lint`
Expected: exit 0, with no new errors in touched files.

- [ ] **Step 3: Touched suites**

Run: `npx jest src/features/alerts/alert-quick-actions src/widgets/alerts-table "src/app/(keep)/dashboard"`
Expected: PASS.

- [ ] **Step 4: Browser check on a local noauth stack with keep-workflows `WATCHER=true`**

Use a short `KEEP_WATCHER_LAPSED_TIME`. Checks:
1. At rest the widget looks as before; hovering shows the gutter checkbox and the tray.
2. Change one alert's status from the tray, and several from the strip.
3. Dismiss forever and Dismiss until, in a preset that hides suppressed alerts (the row leaves) and in one that does not (Suppressed icon).
4. Tick the "No incident" group, then link it to an existing incident and to a new one. The group empties and the count-by line updates without waiting for the 30 s poll.
5. With exactly one critical firing alert across the noisy presets, acknowledging it stops the sound.
6. Esc clears the selection; entering edit mode clears it.
7. On the presets page, row ⋯ actions, bulk actions and drag-select behave as before.

- [ ] **Step 5: Sanity suite alert checks**

Run the `sanity-check` skill (noauth). Expected: the change-status, dismiss and incidents checks are green.

- [ ] **Step 6: Commit any test-only fixes, then report**

Report to the user with commit hashes. Nothing is pushed.
