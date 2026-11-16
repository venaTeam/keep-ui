# Alert tables: original marks, blinking row for noisy critical firing alerts

Status: approved by the user 2026-11-16. Base: origin/dev `fbb5610f`. Repo: keep-ui only.

Supersedes the visual part of "Alert Table readability" (PR #108, branch `feat/alert-table-readability`, head `aff47252`). The user judged it too visually loaded, and its mock misrepresented production.

## Intent

**Why the change.** Readability added severity badges, status pills and a "Noisy" segment to make tables scannable. In practice they made the tables too heavy.

**How the noise signal actually works.** The one signal operators need is "this alert is the one that makes the noisy preset ring". On dev, the only noise cue in a row is the speaker icon, which `getStatusIcon(status, alert.isNoisy)` shows for firing alerts. But the gateway's alert model has no `isNoisy` field, so production alerts never carry it, and a firing alert in a noisy preset looks exactly like any other firing alert.

## Requirements

1. **Original marks.** Severity, status and source cells and the noise column look and behave exactly as on origin/dev, on both:
   - the presets page table (`AlertTableServerSide` via `useAlertTableCols`);
   - the dashboard Alert Table widget (`widget-alerts-table.tsx`).

   This branch is based on dev, so it doesn't carry readability's visuals at all.
2. **Ringing row.** An alert row blinks when all four hold:
   - its severity is exactly `"critical"`;
   - its status is exactly `"firing"`;
   - the alert is not deleted (`deleted === true` is deleted; absent or false is not);
   - the table's preset is noisy (`preset.is_noisy`).

   The first three are exactly the condition the noisy preset's alarm sounds on: `NOISE_BASE_CEL = "status == 'firing' && deleted == false && severity == 'critical'"` (`src/features/presets/custom-preset-links/ui/PresetsNoise.tsx`). The blink must mark exactly the alerts that make the alarm ring, so the helper's JSDoc names `NOISE_BASE_CEL` to keep the two in step (user decision, 2026-11-16).

   The match is exact and case-sensitive, like the alarm's (review of PR #111, 2026-11-16). The gateway's `POST /alerts/query` builds every alert through `AlertDto`, whose validator maps a number to its severity and an unknown word to a default, and serialises both enums as their lowercase values; it never sends a number or another case. The alarm's CEL compares the stored lowercase columns with `=`.

   Every other row is unchanged. The rule needs a single helper with unit tests.
3. **Surfaces.** Both the presets page table and the dashboard Alert Table widget. On the presets page that includes the rows inside groups, when grouped.
   - A collapsed group whose alerts include one that would ring rings its header row instead (same pulse, synced, with `data-ringing` and the reason), since the alarm's count ignores grouping. Expanded, the header is normal and the ringing alerts' own rows ring (review of PR #111).
4. **Blink style.** Revised after the review of PR #111 (2026-11-16).
   - The Count feature's red (`DEFAULT_BLINK_COLOR`, from `blink-palette.ts`) on the Count blink's timing: its own `ringingPulse` keyframes have the same offsets and duration as `missing-blink`, so the two stay in phase.
   - Kept in phase with other blinks on the page, reusing the `useSyncedAnimation` approach.
   - The pulse is an overlay behind each cell's content (a `::before` with a negative z-index in an isolated cell), and only its opacity animates (1 to 0.25), which the browser runs on the compositor. The cells keep their own backgrounds: a last-viewed row shows its orange under the tint, and hovered and selected rows show their plain background with the pulsing edge (see below).
   - The overlay is a 10% tint of the red with a 2px solid red edge on the top and bottom of every cell, the left of the first and the right of the last, so the cells read as one row; the solid edge carries the strong signal. A left-edge strip alone would not show on the presets page, where the critical severity cell already paints a full-height red-500 bar on the row's left edge. On a default (white) or last-viewed row, the tint keeps the row's red-500 marks at 3:1 or more and its text at 4.5:1 or more at every phase. These figures assume the default white row theme.
   - Where two ringing rows touch, exactly one 2px edge separates them, the same weight as a lone ringing row's edges, and it pulses as one line: the lower row drops its top edge (user request, 2026-11-16). On the presets page this follows `<tr data-ringing>` adjacency, including a ringing collapsed group header; a quiet group header between two ringing rows breaks the run. In the widget's grid it follows the previous alert. The run reads as one outline: its left and right edges run on through every row boundary, because a row divider between two ringing rows is removed (`tr[data-ringing] + tr[data-ringing]` gets no top border in `globals.css`, which covers dividers such as `divide-y` and a group header's `border-t`; in the widget's grid the upper row trades its `border-b` for the same 1px of padding).
   - While a ringing table row is hovered, selected or drag-selected, the tint is off and only the edge pulses: at the strong phase the tint would take red-500 marks under 3:1 there (hover 2.84, drag-selecting 2.79, selected 2.50; at the soft phase 3.17, 3.12 and 2.79). Those rows show their plain background exactly as on dev; on dev a selected row's red-500 marks are already at 2.90:1, because the cells repaint the row's half-transparent selection blue over the row's own.
   - With `prefers-reduced-motion`, there is no animation: the overlay holds still at full strength, with the tint off on hovered and selected rows as above.
5. **Accessibility.** A ringing row exposes the reason as text for assistive tech, not by colour or motion alone (e.g. a visually hidden "Ringing: critical, firing, noisy preset" in the row, or an equivalent). Give the row `data-cy="alerts-row-ringing"` or a `data-ringing` attribute for tests and e2e. The hidden reason goes after the content of the row's first cell and is `select-none`, so column autofit (which measures a cell's first element) measures the content and copied text leaves it out (review of PR #111).
6. **Kept from readability:** the pinned-column fix from `aff47252`. Left-pinned cells get a z-index, so horizontally scrolled cells no longer paint over them. After the review of PR #111 it is the same for every left-pinned cell (1), so a later row's non-portaled status tooltip is not hidden under an earlier row's pinned cells. Only `src/shared/ui/utils/table-utils.ts` and its test come across (the readability spec file doesn't exist on this branch). Credit the source commit in the commit message.
7. **No other changes.**
   - The Count feature (`countBy`) is untouched.
   - `getStatusIcon` behaviour is unchanged.
   - No gateway change.

## Approach

- **Shared code:** put the rule helper and one ringing-row hook, `useRingingRows`, under `src/widgets/alerts-table/lib/`. Every surface takes its row attribute, cell classes, colors, sync ref and reason from it.
  - `AlertsTableBody` and `GroupedRow` get an optional `presetNoisy?: boolean`, or an `isRowRinging` predicate. The default (absent or false) renders exactly as today.
  - `AlertTableServerSide` receives `presetNoisy` from `alert-table-tab-panel-server-side.tsx`, which already has the preset, and passes it down.
- **Dashboard widget:** on dev it is a hand-built CSS grid, so a "row" is a run of grid cells.
  - Give every cell of a ringing row the hook's cell props; the pulse must read as one row.
  - The grid keeps its `px-2`. A ringing row's first and last cells take `-ml-2 pl-2` / `-mr-2 pr-2`, so the pulse reaches both edges of the widget while the column tracks, and every quiet row, stay exactly as on dev (review of PR #111).
  - Pass `presetNoisy={!!preset?.is_noisy}` from `preset-alert-table-panel.tsx`.
- **Shared hook:** if `useSyncedAnimation` or the blink palette are needed outside `src/app/(keep)/dashboard/...`, move them to `src/shared/lib/` and keep re-exports at the old paths, so the Count feature's imports and tests are untouched.

## Tests

- **Rule helper:** critical+firing+not deleted+noisy is true. False when any one fails (including a deleted critical firing alert in a noisy preset). A numeric critical severity, or the words in another case, stay quiet.
- **Presets page body:** a ringing row carries the attribute and its cells the overlay; a non-ringing row (including a deleted critical firing one) and a non-noisy preset carry neither; grouped child rows ring too; a collapsed group with a ringing alert rings its header and hands the ring back to the alert when expanded; a ringing row keeps the last-viewed, hover and selection classes.
- **Widget:** every cell of a ringing row carries the overlay and its edge cells stretch over the grid's side padding; other rows (including a deleted critical firing one) don't; a non-noisy preset gives none.
- **Reduced motion:** the pulse uses a `motion-safe:` variant (a class assertion is enough).
- **Contrast:** at every keyframe of `ringingPulse`, red-500 marks keep 3:1 and row text 4.5:1 on default and last-viewed rows; on the hovered, selected and drag-selecting backgrounds the tint would take red-500 under 3:1 at the strong phase. That the tint is off there is covered by class assertions (the hook's `tr.group:hover` / `tr[data-selection]` variants, `data-selection` on selected rows) and a browser check.
- **Shared edges:** between adjacent ringing rows the lower row's cells drop the top edge (body rows, grouped rows, a collapsed group header after a ringing row or header, the widget grid); the upper and lone rows keep theirs; a quiet group header breaks the run.
- **Pinned-column fix:** carried over from readability; its existing tests come along.

## Out of scope

- Readability's badges, pills, "Noisy" segment, column-width changes and noise-column removal.
- Changing `getStatusIcon`, or an alert-level `isNoisy` field in the gateway.
- PR #108 itself. It stays untouched until the user decides whether to close it or update it.
