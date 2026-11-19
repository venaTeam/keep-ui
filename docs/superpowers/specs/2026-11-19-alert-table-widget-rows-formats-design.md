# Alert Table widget: Rows and column formats

Status: proposed 2026-11-19. Base: `integration/alert-tables-quick-actions` @ `e06a07db`, whose tree is the air-gapped dev after `ON-PREM-MERGE.md` Part 0.

## Why

A user asked for the presets page's Relaxed rows on the dashboard Alert Table widget. Long descriptions and other long fields are cut to one line, and the widget always forces Compact. While adding it, we checked the presets table's other display settings and kept only the ones that help someone reading a dashboard.

## What changes

Every setting is saved per widget in dashboard edit mode with Save and is the same for every viewer, like the rest of the widget's customization (#110).

1. **Rows: Compact / Relaxed.** ⚙ Table settings gets a "Rows" section below "Group rows by" (and below "Rows with no value" when shown). It has two radios and a one-line hint. Relaxed is exactly the presets page's Relaxed: rows go from 32 px to at least 48 px with more padding, and name, description and text cells wrap to up to 3 lines.
2. **Format time.** In edit mode, the column header menu gets "Format time ▸" on the date columns the presets page already recognises (`lastReceived`, `createdAt`, `updatedAt`, `firingStartTime`, `firingStartTimeSinceLastResolved`). It offers the same options: Time ago, ISO, Local, Relative, Date only.
3. **Format list.** The same menu gets "Format list ▸" on columns whose values are JSON-string lists, with the same options: Text, Badges, Comma-separated, Pills, Count only, First item only. Array-valued columns (such as `enriched_fields`) render as values in the widget, so they get no Format list (decided after the whole-branch review).

**Left out:**
- Theme (row colours by severity): the widget's rows are see-through on purpose (`rowAppearance="plain"`), so the dashboard background and the noisy blink show.
- Font size: it is already app-wide, dashboards included.
- The presets page's action-tray toggle: the widget has its own quick-actions tray (#115).

**Goals**
- Long text is readable in the widget.
- A widget nobody touches looks exactly as it does today.

**Non-goals**
- Per-viewer settings.
- Unlimited wrap.
- A Rows control in the Edit-widget form.
- Setting formats on narrow widgets: below 320 px the header menu is hidden. Saved formats still apply there.

**Anti-goals**
- The dashboard's Relaxed behaving differently from the presets page's.
- New visible controls in view mode.
- Any change in presets-page behaviour.

## Approaches

1. **Reuse what the widget already has (chosen).** The widget already wraps its table in `RowStyleOverrideProvider` with a hard-coded `"default"`; every header, cell, `AlertName` and skeleton row reads it. The shared cells already read time and list formats from the table's `meta` before anything else. The widget passes its saved values to both. Nothing changes in the presets page, `alert-table-utils.tsx` or the gateway.
2. **Widget-own Relaxed styling.** Rejected: it gives room to tune, but the two Relaxed modes drift apart.
3. **Follow each viewer's presets-page row style.** Rejected: the setting would be per viewer and global. A wall screen would show whatever its account picked, and a change on the presets page would change every dashboard. That breaks the per-widget model.

## Design

- **Config.** `AlertTableWidgetConfig` gains:
  - `rowStyle?: "relaxed" | null`
  - `columnTimeFormats?: Record<string, TimeFormatOption>`
  - `columnListFormats?: Record<string, ListFormatOption>`

  `WidgetColumnChange` gains the same keys. Defaults are never stored:
  - Compact is the absent key; setting Compact passes `null`, which `compactAlertTable` removes.
  - A column set back to Time ago, or to the list default, drops its entry.
  - An empty map drops the key.

  So `applyWidgetColumnChange`, `resetWidgetColumns` and `isCustomized` work unchanged, and undoing a change leaves the widget as if it had never been customized.
- **State.** `useWidgetColumnState` exposes the three values and their setters, saved through `onChange` like the other settings.
- **Rows.** `widget-alerts-table.tsx` passes the saved row style to the `RowStyleOverrideProvider` it already renders, instead of `"default"`.
- **Formats.**
  - The widget's `useReactTable` gets `meta: { columnTimeFormats, columnListFormats }`.
  - `AlertsTableHeaders` gets `showFormatItems={isEditMode}` and the real maps and setters in place of `NO_FORMATS` and `noop`.
- **One shared change.** In `alert-table-headers.tsx`, the format items are gated on `column.getCanSort()`, and the widget table sets `enableSorting: false`, so they would never show. Gate them the way the rename item already is: `column.getCanSort() || !showSortItems`. Every other caller passes the default `showSortItems = true`, so their menus are unchanged.
- **Edit-widget form.** No change. `getAlertTableConfig` spreads the saved config, so Update keeps the new keys.

## Left to the builder

**Browser checks.** Check Relaxed against:
- group header rows, which the widget keeps compact with `py-1`;
- the quick-action tray and the checkbox gutter;
- the noisy blink overlay;
- pinned cells;
- the narrow layout.

**Fallback key.** Cells fall back to the localStorage key `column-time-formats-dashboard-widget-<i>` when `meta` has no entry for a column. Nothing writes that key; confirm it stays harmless.

**Tests:**
- Config and state: defaults never stored, reset, `isCustomized`.
- Format items show in the widget's edit-mode header menu only.
- The presets-page header menu is unchanged.
- Edit-widget form Update keeps the new keys.
- A browser check on a demo stack.

## Delivery

- Local branch `feat/alert-table-widget-rows-formats` from `e06a07db`, worktree `.worktrees/alert-table-widget-rows/keep-ui`.
- Nothing is pushed without an explicit go. On GitHub it follows the six alert-table PRs (gw#126, #112, #109, #110, #111, #115) into dev, as #115 did.
