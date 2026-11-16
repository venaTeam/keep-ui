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
   - its severity is critical, accepting either the word or the numeric severity value (see `severityMapping`);
   - its status is firing;
   - the alert is not deleted (`deleted === true` is deleted; absent or false is not);
   - the table's preset is noisy (`preset.is_noisy`).

   The first three are exactly the condition the noisy preset's alarm sounds on: `NOISE_BASE_CEL = "status == 'firing' && deleted == false && severity == 'critical'"` (`src/features/presets/custom-preset-links/ui/PresetsNoise.tsx`). The blink must mark exactly the alerts that make the alarm ring, so the helper's JSDoc names `NOISE_BASE_CEL` to keep the two in step (user decision, 2026-11-16).

   Every other row is unchanged. The rule needs a single helper with unit tests.
3. **Surfaces.** Both the presets page table and the dashboard Alert Table widget. On the presets page that includes the rows inside groups, when grouped.
4. **Blink style.**
   - The same red pulse as the Count feature's blinking "+N alerts not in an incident" line: the `missing-blink` keyframes / `animate-missing-blink` and its red, from `blink-palette.ts`.
   - Kept in phase with other blinks on the page, reusing the `useSyncedAnimation` approach.
   - It tints the row's background and keeps text legible: a row must stay readable at every point in the pulse.
   - With `prefers-reduced-motion`, there is no animation: a steady light red tint instead.
5. **Accessibility.** A ringing row exposes the reason as text for assistive tech, not by colour or motion alone (e.g. a visually hidden "Ringing: critical, firing, noisy preset" in the row, or an equivalent). Give the row `data-cy="alerts-row-ringing"` or a `data-ringing` attribute for tests and e2e.
6. **Kept from readability:** the pinned-column fix from `aff47252`. Left-pinned cells get their computed z-index, so horizontally scrolled cells no longer paint over them. Only `src/shared/ui/utils/table-utils.ts` and its test come across (the readability spec file doesn't exist on this branch). Credit the source commit in the commit message.
7. **No other changes.**
   - The Count feature (`countBy`) is untouched.
   - `getStatusIcon` behaviour is unchanged.
   - No gateway change.

## Approach

- **Shared code:** put the rule helper and a small row-class/attribute helper under `src/widgets/alerts-table/lib/`.
  - `AlertsTableBody` and `GroupedRow` get an optional `presetNoisy?: boolean`, or an `isRowRinging` predicate. The default (absent or false) renders exactly as today.
  - `AlertTableServerSide` receives `presetNoisy` from `alert-table-tab-panel-server-side.tsx`, which already has the preset, and passes it down.
- **Dashboard widget:** on dev it is a hand-built CSS grid, so a "row" is a run of grid cells.
  - Apply the ringing classes to every cell of a ringing row; the pulse must read as one row.
  - Pass `presetNoisy={!!preset?.is_noisy}` from `preset-alert-table-panel.tsx`.
- **Shared hook:** if `useSyncedAnimation` or the blink palette are needed outside `src/app/(keep)/dashboard/...`, move them to `src/shared/lib/` and keep re-exports at the old paths, so the Count feature's imports and tests are untouched.

## Tests

- **Rule helper:** critical+firing+not deleted+noisy is true. False when any one fails (including a deleted critical firing alert in a noisy preset). Numeric critical severity counts as critical.
- **Presets page body:** a ringing row carries the blink class and the attribute; a non-ringing row (including a deleted critical firing one) and a non-noisy preset carry neither; grouped child rows ring too.
- **Widget:** every cell of a ringing row carries the class; other rows (including a deleted critical firing one) don't; a non-noisy preset gives none.
- **Reduced motion:** the classes use `motion-safe:` / `motion-reduce:` variants (a class assertion is enough).
- **Pinned-column fix:** carried over from readability; its existing tests come along.

## Out of scope

- Readability's badges, pills, "Noisy" segment, column-width changes and noise-column removal.
- Changing `getStatusIcon`, or an alert-level `isNoisy` field in the gateway.
- PR #108 itself. It stays untouched until the user decides whether to close it or update it.
