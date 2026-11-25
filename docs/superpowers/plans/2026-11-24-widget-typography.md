# Dashboard Widget Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let dashboard editors set widget font, text size and title size for the whole dashboard, and override them per widget.

**Architecture:** Pure typography model next to the existing appearance module (ids, factors, clamp, resolve). The widget card gets a `data-widget-typography` attribute plus inline `fontFamily` and `--wt-scale` / `--wt-title` custom properties; one scoped stylesheet rescales the Tailwind/Tremor text utilities under that attribute. Fonts are committed variable `woff2` files loaded with `next/font/local`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind 3.4, Tremor 3, react-hook-form, Jest + RTL.

**Spec:** `docs/superpowers/specs/2026-11-24-widget-typography-design.md`

## Global Constraints

- keep-ui only. No gateway, DB or migration change.
- Nothing fetched from the internet at build or run time; no `next/font/google`.
- Defaults (`system`, `sm`, `normal`) are never stored, and a widget whose resolved typography equals the defaults renders with no attribute and no inline style (identical to today).
- Do not edit `src/widgets/alerts-table/**`.
- No inline explanatory comments; JSDoc only.
- Text-size factors: `sm 1`, `md 8/7`, `lg 4/3`, `xl 32/21`, `2xl 40/21`. Title factors on `1.125rem`: `normal 1`, `large 1.27`, `xl 1.65`.
- Font ids: `system`, `inter`, `roboto`, `ibm-plex-sans`, `source-sans-3`, `atkinson-hyperlegible`, `rubik`, `jetbrains-mono`. Labels/notes as in the spec table (Atkinson label "Atkinson Hyperlegible Next").
- Copy: switch "Custom for this widget"; off line "Uses the dashboard setting: {font} · {size} text · {title} titles. Change it for all widgets in Customize."; iframe note "Applies to the title only."; badge "Custom type".
- `npm run typecheck` and `npm run lint` clean for touched files.

## Review Focus

1. Saved config with garbage typography (`{font: "comic-sans", size: 7}`, an array, `null`) → clamps to defaults; never throws, never emits a bogus CSS value. (Task 1 tests.)
2. Opening the Edit modal and pressing Update without touching anything → the widget is unchanged (no `typography: undefined` key added), so the dashboard stays clean. (Task 5 test, extends `widget-modal-no-op-update.test.tsx`.)
3. Override turned on, then the dashboard setting changed → the overridden widget keeps all three of its own values. (Task 1 resolver test.)
4. Cancel in the Customize panel after changing typography → the canvas reverts (snapshot already covers `appearance`; Task 4 test asserts typography is part of it).
5. Switching widget type in the modal (e.g. Preset → HTML) → `typography` survives `stripForeignTypeFields`. (Task 5 test.)

---

### Task 1: Typography model

**Files:**
- Create: `src/app/(keep)/dashboard/dashboard-appearance/widget-typography.ts`
- Modify: `src/app/(keep)/dashboard/dashboard-appearance/dashboard-appearance-validation.ts` (add `typography?: WidgetTypography` to `DashboardAppearance`; `clampAppearance` keeps `typography` only when `clampWidgetTypography` returns a non-empty object)
- Modify: `src/app/(keep)/dashboard/types.tsx` (add `typography?: WidgetTypography` to `WidgetData`)
- Test: `src/app/(keep)/dashboard/dashboard-appearance/__tests__/widget-typography.test.ts`, extend `dashboard-appearance-validation.test.ts`

**Interfaces — Produces:**
- `type WidgetFontId`, `type WidgetTextSize = "sm"|"md"|"lg"|"xl"|"2xl"`, `type WidgetTitleSize = "normal"|"large"|"xl"`
- `interface WidgetTypography { font?: WidgetFontId; size?: WidgetTextSize; title?: WidgetTitleSize }`
- `type ResolvedWidgetTypography = Required<WidgetTypography>`
- `WIDGET_FONT_IDS: WidgetFontId[]`, `WIDGET_TEXT_SIZES: {id, label, factor}[]`, `WIDGET_TITLE_SIZES: {id, label, factor}[]`
- `DEFAULT_WIDGET_TYPOGRAPHY: ResolvedWidgetTypography`
- `clampWidgetTypography(raw: unknown): WidgetTypography` — keeps only allowlisted values, drops default-valued fields
- `resolveWidgetTypography(widget: WidgetTypography | undefined, dashboard: WidgetTypography | undefined): ResolvedWidgetTypography` — widget wins as a whole when present (non-empty), else dashboard fields over defaults
- `isDefaultTypography(t: ResolvedWidgetTypography): boolean`
- `typographyCardProps(t: ResolvedWidgetTypography, fontStacks: Record<WidgetFontId, string>): { "data-widget-typography"?: ""; style?: React.CSSProperties }` — `{}` for defaults; else `fontFamily` only when font ≠ system, `--wt-scale` only when size ≠ sm, `--wt-title: calc(1.125rem * <f>)` only when title ≠ normal
- `fullOverrideFrom(dashboard: WidgetTypography | undefined): Required<WidgetTypography>` — the seed when the switch is turned on

- [ ] **Step 1: Write failing tests**: clamp (unknown font, numeric size, array, null, partial keeps valid fields, default values dropped); resolve (no widget → dashboard; widget `{font:"inter", size:"sm", title:"normal"}` with dashboard `{size:"xl"}` → `{inter, sm, normal}`; empty widget object → dashboard); `typographyCardProps(DEFAULT)` → `{}`; `{font:"system", size:"lg", title:"normal"}` → attribute + `{"--wt-scale": "1.3333"}` (4 decimals) and no `fontFamily`; `clampAppearance({typography:{size:"xl", font:"bad"}})` → `{typography:{size:"xl"}}`; `clampAppearance({typography:{size:"sm"}})` → `{}`.
- [ ] **Step 2: Implement** the module and the two type additions.
- [ ] **Step 3: Run** (delegated test lane) `npx jest "src/app/(keep)/dashboard/dashboard-appearance"` → PASS.
- [ ] **Step 4: Commit** `feat(dashboard): widget typography model`.

### Task 2: Bundled fonts

**Files:**
- Create: `src/shared/ui/fonts/widget-fonts/<family>/*.woff2` + `LICENSE` per family (variable `wght`, normal style; latin subset, plus hebrew for Rubik), sourced once from the `@fontsource-variable/*` packages via `npm pack` into a scratch dir (not added to `package.json`).
- Create: `src/shared/ui/fonts/widget-fonts.ts`
- Test: `src/shared/ui/fonts/__tests__/widget-fonts.test.ts`

**Interfaces — Consumes:** `WidgetFontId`, `WIDGET_FONT_IDS` (Task 1). **Produces:**
- `WIDGET_FONTS: Record<WidgetFontId, { label: string; note?: string; stack: string }>` — `system.stack` is Tailwind's default sans stack; every other stack is `<next/font family>, ui-sans-serif, system-ui, sans-serif` (`ui-monospace, Menlo, monospace` for JetBrains Mono).
- `WIDGET_FONT_STACKS: Record<WidgetFontId, string>`

Each family is a `localFont({ src: [...], weight: "100 900" (or the family's range), display: "swap", preload: false })` call at module scope.

- [ ] **Step 1: Failing test**: every id in `WIDGET_FONT_IDS` has a label and a stack ending in a generic family; notes match the spec (`current`, `wall screens`, `Hebrew`, `monospace`).
- [ ] **Step 2: Fetch files, write module.**
- [ ] **Step 3: Run** the test → PASS. `ls` shows one `LICENSE` per family directory.
- [ ] **Step 4: Commit** `feat(dashboard): bundle widget fonts`.

### Task 3: Apply on the canvas

**Files:**
- Create: `src/app/(keep)/dashboard/dashboard-appearance/DashboardTypographyContext.tsx` — `DashboardTypographyProvider({ value: WidgetTypography | undefined, children })`, `useDashboardTypography(): WidgetTypography | undefined`
- Create: `src/app/(keep)/dashboard/dashboard-appearance/widget-typography.css` (imported from `GridItem.tsx`)
- Create: `src/app/(keep)/dashboard/dashboard-appearance/CustomTypeBadge.tsx` — renders the "Custom type" pill when `isEditMode && item.typography` non-empty; `data-cy="dashboard-widget-custom-type"`
- Modify: `src/app/(keep)/dashboard/GridItem.tsx` (spread `typographyCardProps(resolve(item.typography, ctx), WIDGET_FONT_STACKS)` on the `Card`; title span gets `data-widget-title`; badge after the title)
- Modify: `src/app/(keep)/dashboard/widget-types/preset/widget-alert-count-panel.tsx` (title `<span>` gets `data-widget-title`; badge after it)
- Test: extend `__tests__/GridItem.test.tsx`, `widget-alert-count-panel-edit-mode.test.tsx`

Stylesheet rules, all under `[data-widget-typography]`:
- every `text-*` size utility found by `grep -rhoE "text-(\[[0-9.]+px\]|xs|sm|base|lg|xl|[2-9]xl|tremor-(label|default|title|metric))"` over the files a widget renders (dashboard widget folders + `src/widgets/alerts-table/ui`, `src/widgets/alerts-table/lib`, `src/entities/alerts/ui`), rewritten as `font-size: calc(<tailwind size> * var(--wt-scale, 1)); line-height: calc(<tailwind line-height> * var(--wt-scale, 1))`;
- the arbitrary variant `[&>table]:text-xs` (its table child) the same way;
- `[data-widget-typography] [data-widget-title] { font-size: var(--wt-title, 1.125rem); line-height: 1.3; }` placed last.

- [ ] **Step 1: Failing tests**: GridItem with no typography anywhere → Card has no `data-widget-typography` and no inline `fontFamily`; with context `{size:"xl"}` → attribute present and `--wt-scale` set; with `item.typography` and edit mode → badge shown, out of edit mode → not shown; count panel title has `data-widget-title` and badge in edit mode.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** the two test files plus `GridLayout.test.tsx` → PASS.
- [ ] **Step 4: Commit** `feat(dashboard): apply widget typography on the canvas`.

### Task 4: Customize panel section

**Files:**
- Create: `src/app/(keep)/dashboard/dashboard-appearance/TypographyControls.tsx` — `TypographyControls({ value: WidgetTypography; onChange(next: WidgetTypography); fontPicker: "list" | "select"; idPrefix: string })`: font list or Tremor `Select` (each item styled with its stack), text-size and title-size segmented groups (`role="group"`, buttons `aria-pressed`), preview line. Caption per size step = `Math.round(10.5/14 * rootPx * factor * 10)/10` px where `rootPx` = `parseFloat(getComputedStyle(document.documentElement).fontSize)` (fallback 14).
- Modify: `DashboardSettingsPanel.tsx` — "Typography" section below Grid density using `TypographyControls fontPicker="list"`; onChange writes `appearance.typography` through `clampWidgetTypography` (so picking defaults removes keys).
- Test: extend `__tests__/dashboard-settings-panel.test.tsx`

- [ ] **Step 1: Failing tests**: clicking "Inter" calls `onChange` with `{typography:{font:"inter"}}`; clicking `S` after `XL` removes `size`; selected step has `aria-pressed="true"`; Reset still calls `onReset`.
- [ ] **Step 2: Implement.** `dashboard.tsx` needs no change for Reset/Cancel (they already swap the whole `appearance`).
- [ ] **Step 3: Run** the panel test → PASS.
- [ ] **Step 4: Commit** `feat(dashboard): typography in the Customize panel`.

### Task 5: Edit Widget modal section

**Files:**
- Create: `src/app/(keep)/dashboard/dashboard-appearance/WidgetTypographySection.tsx` — `WidgetTypographySection({ value: WidgetTypography | undefined; dashboard: WidgetTypography | undefined; widgetType: WidgetType; onChange(next: WidgetTypography | undefined) })`: divider, header "Typography" + Tremor `Switch` "Custom for this widget"; off → summary line from `resolveWidgetTypography(undefined, dashboard)`; on → `TypographyControls fontPicker="select"` + "Applies to the title only." for `IMAGE`, `HTML`, `GRAFANA_PANEL`. Switch on → `onChange(fullOverrideFrom(dashboard))`; off → `onChange(undefined)`.
- Modify: `WidgetModal.tsx` — new prop `dashboardTypography?: WidgetTypography`; local state `typography` initialised from `editingItem?.typography`; on submit, set `typography` on the result only when defined and `delete` it when the switch is off; unchanged state must leave the object identical.
- Modify: `widget-type-fields.ts` only if `typography` is stripped there (expected: no change; test proves it).
- Test: `dashboard-appearance/__tests__/widget-typography-section.test.tsx`; extend `__tests__/widget-modal-no-op-update.test.tsx`, `__tests__/widget-type-fields.test.ts`

- [ ] **Step 1: Failing tests**: switch off by default with the summary text for dashboard `{size:"xl"}` ("System default · XL text · Normal titles"); switch on emits the full seeded override; switch off emits `undefined`; iframe note only for the three types; no-op Update keeps `dashboardEditKey` equal (existing pattern) both with and without a saved override; `stripForeignTypeFields({...item, typography}, WidgetType.HTML)` keeps `typography`.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** these test files → PASS.
- [ ] **Step 4: Commit** `feat(dashboard): per-widget typography override`.

### Task 6: Wire the dashboard page

**Files:**
- Modify: `src/app/(keep)/dashboard/[id]/dashboard.tsx` — wrap `GridLayout` in `DashboardTypographyProvider value={appearance.typography}`; pass `dashboardTypography={appearance.typography}` to `WidgetModal`; when loading `config.widget_data`, map each widget's `typography` through `clampWidgetTypography` (drop the key when empty).
- Test: extend `__tests__/dashboard-edit-mode.test.tsx` — a saved widget with `typography: {font:"bad"}` loads with no `typography` key and renders no attribute.

- [ ] **Step 1: Failing test.** **Step 2: Implement.** **Step 3: Run** the dashboard `__tests__` folder → PASS. **Step 4: Commit** `feat(dashboard): wire widget typography into the dashboard page`.

### Task 7: Verify

- [ ] `npm run typecheck`; `npx eslint` on touched files; full `npx jest "src/app/(keep)/dashboard" src/shared/ui/fonts` — all clean (delegated lane).
- [ ] Browser on a local noauth stack: a scratch dashboard with Preset table, count panel, Metric, Generic Metrics, Incident Table, HTML widgets. Check: default looks identical to dev; dashboard XL + Inter; one widget override (badge in edit mode only, gone in view mode); Save → reload persists; Cancel reverts; dark mode; root font Small vs Large stacks; main alerts page unchanged. Screenshots saved to scratch.
- [ ] Leave the stack running for the user.
