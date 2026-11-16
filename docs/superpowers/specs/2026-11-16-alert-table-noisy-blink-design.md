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
4. **Blink style.** Revised after the review of PR #111 (2026-11-16).
   - The Count feature's red (`DEFAULT_BLINK_COLOR`, from `blink-palette.ts`) on the Count blink's timing: its own `ringingPulse` keyframes have the same offsets and duration as `missing-blink`, so the two stay in phase.
   - Kept in phase with other blinks on the page, reusing the `useSyncedAnimation` approach.
   - The pulse is an overlay behind each cell's content (a `::before` with a negative z-index in an isolated cell), and only its opacity animates (1 to 0.25), which the browser runs on the compositor. The cells keep their own backgrounds, so hover, last viewed and selection still show under the tint.
   - The overlay is a 10% tint of the red with a 2px solid red edge on the top and bottom of every cell, the left of the first and the right of the last, so the cells read as one row. The tint keeps the row's red-500 marks at 3:1 or more and its text at 4.5:1 or more at every phase; the solid edge carries the strong signal. A left-edge strip alone would not show on the presets page, where the critical severity cell already paints a full-height red-500 bar on the row's left edge.
   - With `prefers-reduced-motion`, there is no animation: the overlay holds still at full strength.
5. **Accessibility.** A ringing row exposes the reason as text for assistive tech, not by colour or motion alone (e.g. a visually hidden "Ringing: critical, firing, noisy preset" in the row, or an equivalent). Give the row `data-cy="alerts-row-ringing"` or a `data-ringing` attribute for tests and e2e.
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
  - Pass `presetNoisy={!!preset?.is_noisy}` from `preset-alert-table-panel.tsx`.
- **Shared hook:** if `useSyncedAnimation` or the blink palette are needed outside `src/app/(keep)/dashboard/...`, move them to `src/shared/lib/` and keep re-exports at the old paths, so the Count feature's imports and tests are untouched.

## Tests

- **Rule helper:** critical+firing+not deleted+noisy is true. False when any one fails (including a deleted critical firing alert in a noisy preset). A numeric critical severity, or the words in another case, stay quiet.
- **Presets page body:** a ringing row carries the attribute and its cells the overlay; a non-ringing row (including a deleted critical firing one) and a non-noisy preset carry neither; grouped child rows ring too; a ringing row keeps the last-viewed, hover and selection classes.
- **Widget:** every cell of a ringing row carries the class; other rows (including a deleted critical firing one) don't; a non-noisy preset gives none.
- **Reduced motion:** the pulse uses a `motion-safe:` variant (a class assertion is enough).
- **Contrast:** red-500 marks keep 3:1 and row text 4.5:1 on the ringing row's background at every keyframe of `ringingPulse`, on white and on the last-viewed orange.
- **Pinned-column fix:** carried over from readability; its existing tests come along.

## Out of scope

- Readability's badges, pills, "Noisy" segment, column-width changes and noise-column removal.
- Changing `getStatusIcon`, or an alert-level `isNoisy` field in the gateway.
- PR #108 itself. It stays untouched until the user decides whether to close it or update it.
