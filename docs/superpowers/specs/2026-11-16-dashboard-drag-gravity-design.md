# Dashboard drag-and-drop: vertical gravity — design

Date: 2026-11-16 · Size: small change · Status: approach approved by the user (option A)

## Intent

Rearranging panels while editing a dashboard feels broken. When a dragged panel passes over or onto
other panels, they jump far down and never come back, leaving holes. The goal is for dragging to behave
the way people know from Grafana and Metabase. The panels you drop onto move just far enough to make
room, and everything settles back up into free space.

## What is wrong today (verified)

The grid (`src/app/(keep)/dashboard/GridLayout.tsx`) passes `compactType={null}` to react-grid-layout
1.5.3 and no `preventCollision`. This setting was inherited from upstream Keep. In null mode, the first
touch of another panel triggers the library's collision branch: it moves the dragged panel to the
target's top and pushes the target down by the target's full height. `compact(null)` then cascades the
overlaps further down. Nothing ever floats back up.

Two independent checks gave the same results on a 7-panel probe dashboard (`dnd probe`):

- real mouse drags in Chrome against the local stack;
- a replay of the library's own `moveElement` + `compact`.

What they showed:

- Panels a drag only passes over get shoved down. Dropping a panel into empty space below everything
  pushed two untouched panels 30 rows down.
- Dragging out and back does not restore the layout.
- Pushed panels overshoot and leave large empty bands.
- The drop placeholder flickers and can disagree with the landing spot (up to 9 rows on a fast drag).

These were ruled out: cursor tracking (≤1.3 px drift), iframes in HTML or Grafana widgets (the
edit-mode `inert` body is not hit-testable), the parent's state handling, and the recent edit-mode
commits (a2ef65fc, 7132a633).

## Goals

- Panels pushed by a drag return when the drag moves away.
- A drag never displaces panels it does not end up colliding with.
- A dropped panel pushes the panels under it down just enough to clear it.
- Panels never overlap.

## Non-goals

These are possible follow-ups and were not asked for:

- Escape to cancel a drag
- auto-scroll near the edges while dragging
- a shorter move animation (NN/g suggests about 100 ms; the library uses 200 ms)
- swapping panels of the same size
- keyboard moves
- upgrading react-grid-layout to 2.x

## Anti-goals

- Any behaviour that lets panels overlap or be stacked on top of each other.
- Writing compacted layouts back to the server without the user saving.

## Constraints and accepted trade-off

Vertical compaction also applies when a dashboard is displayed. A saved dashboard that contains vertical
gaps will render with those gaps closed, in view mode too, without anyone saving. Grafana and Metabase
work the same way, and the user accepted this (option A). The saved layout in the database only changes
when someone edits the dashboard and saves it. In view mode `onLayoutChange` stays ignored, as it is
today. Two of the five dashboards on the local stack would shift.

## Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Vertical gravity everywhere** (`compactType="vertical"`) | Matches react-grid-layout's default, Grafana (Scenes passes no compactType) and Metabase (explicit `compactType="vertical"`). View and edit always agree. Gapped dashboards tighten up for everyone. | **Chosen** |
| B. Gravity only while editing | View mode keeps saved gaps until someone edits and saves. A gapped dashboard visibly jumps when Edit is clicked, so view and edit disagree. | Rejected |
| `preventCollision` with null compaction | A panel cannot be dropped onto another at all, which is rigid and matches no reference tool. | Rejected |
| Upgrade to react-grid-layout 2.x | Breaking API change. Its default compaction is the same as v1 vertical, so it gives no behaviour gain for this bug. | Rejected |

## Design

- `GridLayout.tsx` exports `GRID_COMPACT_TYPE = "vertical"` and passes it as `compactType`. Nothing else
  in the grid configuration changes: `preventCollision` and `allowOverlap` stay at their defaults of
  false.
- The page compacts the saved layout once when the dashboard loads (`compactLayout` in
  `widget-layout.ts`), so the page's layout state equals what the grid shows. Without this, a breakpoint
  change while editing (opening Customize, resizing the window) reports the compacted positions and
  falsely raises the "Discard unsaved changes?" warning on dashboards saved with gaps. The small-screen
  stacking order also follows what desktop shows. Nothing is written until the user saves.
- New widgets are added at the bottom of the layout (`layoutBottom`), not at (0,0). Under vertical
  compaction, a widget at (0,0) would be wedged under the top-left panel and push only that column down,
  breaking row alignment. From the bottom it floats up into free space only.
- The responsive stacked layout for small screens (1 column, built by `buildStackedLayout`) is already
  gap-free, so vertical compaction leaves it unchanged.
- `react-grid-layout`'s typings leave out its runtime `utils`. `src/types/react-grid-layout-utils.d.ts`
  declares the one helper used (`compact`).
- Tests (`src/app/(keep)/dashboard/__tests__/GridLayout.test.tsx`) cover two things:
  - wiring: the grid receives `compactType="vertical"`, collisions are not prevented and overlap is not
    allowed;
  - drag behaviour: real drags are replayed through react-grid-layout's own `moveElement`/`compact` with
    `GRID_COMPACT_TYPE`, step by step as the library's `onDrag` handler does. They assert the goals
    above (there-and-back restores, untouched panels stay put, the push goes just below the dropped
    panel, no overlap at any step, a gap above a panel closes). All of these fail under the old null
    setting except no-overlap, which is a guard that passes there too.
- Page tests (`__tests__/dashboard-edit-mode.test.tsx`) cover two cases. Cancel raises no warning when
  the grid reports the positions it already shows on a gapped dashboard, and a new widget lands below the
  existing panels.

## Known limitation

react-grid-layout's own vertical compaction has an edge case. A full-width panel dropped about one row
below the top lands under the first panel, and the panels to its right stay under it. This leaves a hole
at the top right until they are dragged up. It comes from the library's collision resolution, not
Keep's code, and the panels can be dragged back up.

## Verification

- `npx jest --runTestsByPath` on the dashboard test folders passes.
- `npm run typecheck` and `npm run lint` add no new errors compared with dev.
- The eight browser scenarios from the investigation, re-run against the branch, show:
  - no displaced bystanders;
  - there-and-back restores the layout;
  - no overlaps after a drop;
  - the placeholder matches the landing spot.

## Left to the builder

- Exact test fixture values.
- The demo kit ports.
