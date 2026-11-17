# Dashboard Drag Gravity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dragging a dashboard panel over others pushes them just enough and lets everything float back up, instead of shoving bystanders down permanently.

**Architecture:** One configuration change in `GridLayout.tsx`: `compactType` goes from `null` to the exported constant `GRID_COMPACT_TYPE = "vertical"`. Tests pin two things. The first is the wiring, with react-grid-layout's `Responsive` mocked to capture props. The second is the user-visible drag behaviour, replayed through the library's real `utils.moveElement`/`utils.compact` the same way its `onDrag` handler calls them.

**Tech Stack:** Next.js 15 / React 19, react-grid-layout 1.5.3, Jest + Testing Library (next/jest preset).

**Spec:** `docs/superpowers/specs/2026-11-16-dashboard-drag-gravity-design.md`

## Global Constraints

- `compactType` must be `"vertical"`. `preventCollision` and `allowOverlap` stay unset, so they keep the library default `false`.
- No react-grid-layout version change, no new dependencies.
- No server/API change.
- In view mode, `onLayoutChange` must keep being ignored, so a compacted render never reaches the saved layout without the user saving.
- Comments: JSDoc only, no inline explanatory comments.
- Run Jest paths that contain `(keep)` with `--runTestsByPath`.

## Review Focus

1. **A saved dashboard with gaps opened in view mode.** It renders tightened. The library fires `onLayoutChange` with the compacted layout, and the parent must not receive it. Task 1 test: `ignores layout changes outside edit mode`.
2. **Growing a panel (resize) and shrinking it back.** Panels below are pushed down, then return. Task 1 test: `restores the panels below when a panel grows and shrinks back`.
3. **Adding a widget, which is placed at (0,0) on top of an existing panel.** It must not overlap anything. Task 1 test: `places a widget added at the top-left without overlapping`.
4. **Entering edit mode on a gapped dashboard and cancelling without dragging.** No "unsaved changes" warning appears. Task 2 browser check.
5. **Narrow screens (the 1-column stacked layout).** Order and stacking are unchanged. Task 2 browser check at a 900 px wide viewport.

---

### Task 1: Vertical gravity in the dashboard grid

**Files:**
- Modify: `src/app/(keep)/dashboard/GridLayout.tsx`: export the constant and pass it as `compactType`.
- Create: `src/app/(keep)/dashboard/__tests__/GridLayout.test.tsx`

**Interfaces:**
- Produces: `export const GRID_COMPACT_TYPE: "vertical"` from `GridLayout.tsx`, with a JSDoc line explaining the choice (Grafana/Metabase parity).

- [ ] **Step 1: Write the failing tests**

Mock `react-grid-layout` so that `Responsive` records its props and renders its children inside a div, and `WidthProvider` is the identity. Load the real `utils` with `jest.requireActual("react-grid-layout").utils`, cast to a local `GridUtils` interface (`moveElement`, `compact`, `collides`, `getLayoutItem`, `cloneLayout`), because `@types/react-grid-layout` does not type `utils`.

Fixture (24 cols): `c1 0,0,6,5` · `c2 6,0,6,5` · `h1 12,0,6,5` · `c3 18,0,6,5` · `t1 0,5,12,10` · `h2 12,5,12,10` · `c4 0,15,24,4`.

Helper `drag(layout, id, waypoints)` interpolates 25 integer steps per waypoint. At each step it calls `moveElement(layout, item, x, y, true, false, GRID_COMPACT_TYPE, 24, false)` then `compact(layout, GRID_COMPACT_TYPE, 24)`, and records whether any pair overlapped at any step.

`describe("dashboard grid wiring")`:
- `uses vertical compaction without blocking or allowing overlap`: render `<GridLayout layout={[]} data={[]} …/>` inside `DashboardEditModeProvider value`. Expect `captured.compactType === "vertical"`, `captured.preventCollision` falsy, and `captured.allowOverlap` falsy.
- `ignores layout changes outside edit mode`: render with the provider value `false`, call `captured.onLayoutChange([{ i: "c1", x: 0, y: 0, w: 6, h: 5 }])`, and expect the `onLayoutChange` prop not to have been called. With the provider value `true`, expect it to have been called once.

`describe("dragging panels")`, each test using the fixture:
- `returns every panel to its place when a drag goes out over others and comes back`: drag `c2` via `[6,10]` then `[6,0]`. Expect all positions equal to the start positions.
- `does not displace panels a drag only passes over`: drag `c1` to `[0,22]`. Expect `t1`, `c2`, `h1`, `c3`, `h2` and `c4` unchanged.
- `pushes the panel under a drop just below the dropped panel`: drag `c1` to `[3,10]`. Expect `t1.y === c1.y + c1.h`.
- `never overlaps panels at any step`: for all eight investigation scenarios, expect `overlapSeen === false`. The scenarios are `c1→[6,0]`, `c1→[3,10]`, `c4→[0,0]`, `c3→[15,10]`, `c2→[6,10],[6,0]`, `t1→[12,5]`, `c1→[0,22]` and `c2→[6,3]`.
- `closes a gap above a panel`: compact `[{i:"a",x:0,y:0,w:6,h:5},{i:"b",x:0,y:12,w:6,h:5}]`. Expect `b.y === 5`.
- `restores the panels below when a panel grows and shrinks back`: set `c1.h = 12`, compact, and expect `t1.y === 12`. Set `c1.h = 5`, compact, and expect `t1.y === 5` and `c4.y === 15`.
- `places a widget added at the top-left without overlapping`: append `{i:"new",x:0,y:0,w:3,h:3}` to the fixture, compact, and expect no overlapping pair.

- [ ] **Step 2: Run the tests and see the behaviour tests fail**

Run: `npx jest --runTestsByPath "src/app/(keep)/dashboard/__tests__/GridLayout.test.tsx"`

Expected: FAIL. The wiring test fails on `compactType` (received `null`), and the drag tests fail on displaced panels and overshoot. This holds while the constant temporarily exists as `null`: export `GRID_COMPACT_TYPE` as `null` first, so the import resolves and the failures are behavioural.

- [ ] **Step 3: Set `GRID_COMPACT_TYPE = "vertical" as const` and pass `compactType={GRID_COMPACT_TYPE}`**

- [ ] **Step 4: Run the tests and see them pass**

Run: the same command as Step 2, then the whole dashboard folder: `npx jest --runTestsByPath $(git ls-files 'src/app/(keep)/dashboard' | grep -E '\.test\.tsx?$')`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(keep)/dashboard/GridLayout.tsx" "src/app/(keep)/dashboard/__tests__/GridLayout.test.tsx"
git commit -m "fix(dashboard): let panels float back when dragging over others"
```

### Task 2: Verify against dev and in the browser, then hand over a live demo

**Files:**
- Create: `/Users/yarin/keep-namespace/.worktrees/dashboard-drag-gravity/demo/start-demo.sh`, `stop-demo.sh` and `README.md`. They live outside the repo, so they are not committed.

**Interfaces:**
- Consumes: the Task 1 branch head.

- [ ] **Step 1: Gates.** Run `npm run typecheck` and `npm run lint` on the branch and on `origin/dev`. Expected: the branch adds no new errors or warnings (dev has known pre-existing ones).
- [ ] **Step 2: Demo stack.** Start the UI from the worktree on :3005 and a gateway on 127.0.0.1:8092, both noauth, against the shared `cbm-e2e-pg` DB on :5440. Set `KEEP_CORS_TRUSTED_ORIGINS=http://localhost:3005`, and apply the macOS fixes `NO_PROXY='*'` and `PGGSSENCMODE=disable`. Seed a `dnd gapped` dashboard: a copy of the probe layout with a 6-row gap above `c4`. Expected: `/signin` returns 200, and both `dnd probe` and `dnd gapped` load.
- [ ] **Step 3: Browser re-run.** Re-run the eight investigation scenarios on :3005 with real mouse drags, plus Review Focus items 4 and 5. Expected:
  - no bystander moves except the minimal push;
  - there-and-back restores the layout;
  - no overlap after any drop;
  - the placeholder equals the landing spot after a hold;
  - Cancel on `dnd gapped` raises no warning;
  - the narrow viewport stacks in order.
- [ ] **Step 4: Whole-branch review** by one fresh reviewer, then fix or explain each finding.
- [ ] **Step 5: Hand over the demo:** URLs, what to try, and how to stop it.
