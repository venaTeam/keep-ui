# Dashboard widget typography — design

Date: 2026-11-24 · Repo: keep-ui only · Base: `origin/dev` (1b3935ae)
Mock (approved direction): https://claude.ai/artifact/TMyB86crzKYhek73K8xhmE (variant A = Customize panel, variant B = Edit Widget modal)

## Intent

Dashboard widget text is too small for the people reading it, and the font is not the one they want. Today the alert-table cells render at `text-xs` on a 14px root (10.5px) and widget titles at `text-lg` (~15.75px), in the system font stack. Dashboards often run on wall screens in a NOC, where that is hard to read from a distance.

The people who build a dashboard should be able to set its typography (font, text size, title size) once, for everyone who opens it, and give a single widget its own typography when that widget needs to differ (a dense alert table next to large counters).

## Who sets it

- Typography belongs to the dashboard. Whoever can save the dashboard sets it for every viewer.
- Saving already requires `write:dashboards` (`PUT /dashboards/{id}` in keep-api-gateway). Admin, Editor and Superadmin hold it; Viewer and NOC are `read:*` and only see the result. No new permission work.
- No per-viewer preference.

## Goals

1. Dashboard-wide typography in the existing Customize slide-over (`DashboardSettingsPanel`): Font, Text size, Title size, with the live preview and the Cancel/Reset behaviour the panel already has.
2. Per-widget override in the Edit Widget modal (`WidgetModal`): a Typography section with a "Custom for this widget" switch. Off (default) = the widget follows the dashboard. On = Font, Text size, Title size for this widget only.
3. A fixed set of fonts bundled with keep-ui, served from the app itself.
4. Existing dashboards look exactly as they do today until someone picks something.

## Non-goals

- Per-viewer / per-user preferences.
- Uploading custom fonts, free-form px input, font weight, letter-spacing, text color.
- Typography inside iframe or image content: the HTML widget's `srcDoc`, the Grafana Panel iframe, the Image widget. These widgets get the title typography only.
- Any page outside dashboards (alerts page, incidents page, sidebar).
- keep-api-gateway, DB or migration changes.

## Anti-goals (a failure even if it works)

- Loading anything from the internet at build or run time (prod is air-gapped; CI builds images from `dev` with no internet access).
- Changing the look of any existing dashboard by default.
- Adding visible weight to dashboards in view mode. The only indicator of an override is a small "Custom type" badge, shown in edit mode only.
- Editing the shared alerts-page components (`src/widgets/alerts-table/**`) in a way that changes the main alerts page.

## Constraints and facts the builder needs

- Dark mode is a global CSS `invert()` filter (`workaround-dark` on `<html>`). Fonts are unaffected; nothing dark-mode specific is needed.
- Root font size is **per viewer**, not fixed. `globals.css` sets 14px, but `FontSizeInitializer` (mounted in `src/app/(keep)/layout.tsx`) runs `useFontSize` (`src/shared/lib/hooks/useFontSize.ts`), which writes `document.documentElement.style.fontSize` from localStorage `keep-ui-font-size`: Small 14px / Medium 16px (default) / Large 18px, chosen in the alerts table settings (`FontSizeSelection.tsx`). Every Tailwind `text-*` utility is rem-based off that root, so most viewers today see alert-table cells at 12px and titles at 18px. The px figures elsewhere in this doc are quoted at a 14px root; see "Interaction with the viewer's font size" for how the two settings combine.
- Widget content sizes its text with fixed Tailwind utilities, not inherited `em`. Counts on `origin/dev`: `widget-alert-count-panel.tsx` (text-4xl, text-xl, text-xs), `incident-table-grid-item.tsx` (text-base/sm/xs), `widget-alerts-table.tsx` (text-xs, `[&>table]:text-xs`), `widget-service-now.tsx` (text-4xl/sm/xs), `group-by-select.tsx` (Tremor `text-tremor-*`), `row-style-control.tsx` / `widget-table-settings.tsx` (`text-[10px]`, `text-[11px]`). The alert table widget renders `AlertsTableHeaders` / `AlertsTableBody` from `src/widgets/alerts-table`, which carry their own sizes. Metric and Generic Metrics widgets render Tremor charts (Recharts SVG ticks use Tremor label classes). So setting `font-size` on the widget container alone does **not** scale the content.
- The widget title is rendered in `GridItem.tsx` (`<span className="text-lg font-bold …" data-cy="dashboard-widget-title">`). The alert-count panel has no title row (its name lives in its body).
- Dashboard appearance today: `dashboard_config.appearance = { backgroundColor?, density? }`, read through `clampAppearance` in `dashboard-appearance/dashboard-appearance-validation.ts`, which drops anything it does not recognise. Per-widget settings live on each `WidgetData` entry in `dashboard_config.widget_data` (see `alertTable?: AlertTableWidgetConfig` for the precedent). The gateway stores `dashboard_config` as opaque JSON; unknown keys are accepted.
- Duplicate dashboard (`features/dashboard-duplicate`) copies `dashboard_config`, so typography carries over with no extra work.
- Repo house rules: no inline explanatory comments (JSDoc/docstrings only); `npm run typecheck` and `npm run lint` must pass (the build ignores both); Jest for pure guards, RTL for components, as the appearance and image/html widget modules do.

## Approaches considered

1. **Dashboard-wide only** (Customize panel). Smallest change, but one dense table cannot get larger text without enlarging every counter and chart.
2. **Dashboard-wide + per-widget override.** **Chosen by the user (2026-11-24).** Real dashboards mix widgets with very different density; the override handles that without overloading the dashboard setting. Cost: one more control block in the modal, a badge, and a precedence rule.

Rejected mechanisms for scaling content (builder context, my calls):
- CSS `zoom` / `transform: scale` on the widget body: scales padding, column widths and chart geometry too, and breaks react-grid-layout and column-resize measurements.
- Rewriting every widget to `em`-based sizes: touches shared alerts-page components (anti-goal) and many files for no extra benefit.

## Design

### Settings model

```ts
type WidgetFontId = "system" | "inter" | "roboto" | "ibm-plex-sans" | "source-sans-3" | "atkinson-hyperlegible" | "rubik" | "jetbrains-mono";
type WidgetTextSize = "sm" | "md" | "lg" | "xl" | "2xl";
type WidgetTitleSize = "normal" | "large" | "xl";

interface WidgetTypography {
  font?: WidgetFontId;
  size?: WidgetTextSize;
  title?: WidgetTitleSize;
}
```

- Dashboard-wide: `dashboard_config.appearance.typography?: WidgetTypography`. An absent key, or an absent field inside it, means the default (`system`, `sm`, `normal`). Defaults are not stored, matching the existing appearance and `AlertTableWidgetConfig` convention.
- Per-widget: `WidgetData.typography?: WidgetTypography`. **Present = override on; absent = follow the dashboard.** When the switch is turned on, all three fields are stored explicitly (seeded from the dashboard's current effective values), so a later dashboard change does not partially leak into an overridden widget. Turning the switch off deletes the key.
- Both are read through clamp functions that keep only allowlisted ids (extend `clampAppearance`; add a `clampWidgetTypography` used when widget data is loaded). Bad or unknown values fall back silently.
- Precedence (one pure resolver, unit-tested): widget override → dashboard → defaults. The override applies as a whole, never field by field.

### Fonts

| id | Family | Note shown in the picker | Weights |
|----|--------|--------------------------|---------|
| system | System default (today's stack) | "current" | — |
| inter | Inter | | 400, 600, 700 |
| roboto | Roboto | | 400, 500, 700 |
| ibm-plex-sans | IBM Plex Sans | | 400, 600, 700 |
| source-sans-3 | Source Sans 3 | | 400, 600, 700 |
| atkinson-hyperlegible | Atkinson Hyperlegible Next | "wall screens" | 400, 700 |
| rubik | Rubik | "Hebrew" (latin + hebrew subsets) | 400, 600, 700 |
| jetbrains-mono | JetBrains Mono | "monospace" | 400, 600, 700 |

- Weights (my call, supersedes the column above): widget content uses `font-medium` (500), `font-semibold` (600), `font-bold` (700) and `font-black` (900, the count panel's big number). Ship **one variable-weight `woff2` per family** (and per subset for Rubik) so every weight the widgets use renders as designed: Inter, Roboto, IBM Plex Sans, Source Sans 3 and Rubik reach 900; Atkinson Hyperlegible **Next** (the upstream variable successor, OFL) and JetBrains Mono top out at 800, where the browser uses 800 for 900, which is acceptable. Normal style only, no italics.
- Delivery (my call): `woff2` files committed under the repo (e.g. `src/shared/fonts/<family>/`), declared with `next/font/local` (`preload: false`, `display: "swap"`, one CSS variable per family). `next/font/google` is ruled out because it downloads at build time. The browser downloads a face only when a dashboard uses it.
- Each family's licence file (OFL 1.1; Apache 2.0 for Roboto) is committed next to its files.
- Every stack ends in the system fallback so a missing face degrades to today's look.
- The builder fetches the files once from the upstream projects and commits them; nothing is fetched at build time.

### Text size and title size

Text size is a multiplier on what each widget renders today. The picker labels each step with the alert-table cell size it produces (px below at a 14px root; the live caption follows the viewer's root, see the next section):

| step | multiplier | table cell size at 14px root |
|------|-----------|-----------------|
| S (default) | 1 | 10.5px |
| M | 8/7 ≈ 1.143 | 12px |
| L | 4/3 ≈ 1.333 | 14px |
| XL | 32/21 ≈ 1.524 | 16px |
| 2XL | 40/21 ≈ 1.905 | 20px |

Title size is independent of text size and is also a multiplier on today's `text-lg` title: Normal = ×1, Large = ×1.27 (20px at a 14px root), XL = ×1.65 (26px at a 14px root).

### Interaction with the viewer's font size (decided by the user, 2026-11-24: stack)

- The dashboard steps **stack on the viewer's own Small/Medium/Large root size**: every size stays rem-based and is multiplied by the step's factor. S and Normal are ×1, so each viewer sees exactly what they see today until an owner picks a larger step.
- What is stored is the **step id** (`"xl"`), never a computed size or a running product. The next editor sees XL selected; choosing another step replaces it. Steps never compound across edits. The only multiplication is step factor × the viewer's root.
- Picker captions show the resulting alert-table cell size **on the current viewer's screen** (computed from the live root font size), so an editor on Medium sees S = 12px, M ≈ 13.7px, and so on. Unit tests assert factors, not px.

### How it is applied (my call)

- The widget card in `GridItem.tsx` gets `data-widget-typography` plus inline style from the resolved settings: `fontFamily` (font stack), `--wt-scale` (text multiplier) together with `font-size: calc(1rem * <factor>)` so text without a size utility scales too, and `--wt-title-scale` (title multiplier). Each title keeps its own base size (`GridItem` title 1.125rem, counter name 1.25rem), so a Normal title stays exactly today's size. Only widgets whose resolved settings differ from the defaults get the attribute, so untouched dashboards render byte-for-byte as today.
- One scoped stylesheet next to the dashboard styles redefines, under `[data-widget-typography]` only:
  - `font-family: var(--wt-font)` on the card and its descendants (inputs and buttons included).
  - Every `text-*` font-size utility used inside widget content (`text-[10px]`, `text-[11px]`, `text-xs` … `text-4xl`, Tremor `text-tremor-label`, `text-tremor-default`, `text-tremor-title`, `text-tremor-metric`) as `calc(<original size> * var(--wt-scale))`, keeping each utility's line-height ratio.
  - The title elements (`[data-widget-title]`, and `[data-widget-title="counter"]` for the counter name) to `calc(<base> * var(--wt-title-scale, 1))`, line-height scaled the same way.
  - `leading-*` utilities used inside widgets (`leading-none`) are restored after the text rules, so a utility's line-height override still wins.
- Alert-count panel (my call): it has no `GridItem` title row; its name is the `text-xl font-bold` span in `widget-alert-count-panel.tsx`. That span is its title: it gets a title hook (class or `data-` attribute), takes `--wt-title`, and is exempt from the `--wt-scale` rule. The "Custom type" badge sits right after that name. Title size is therefore offered for this panel like any other widget.
- The shared alerts-page components are not edited; the scope is the attribute, so the main alerts page is untouched.
- The builder confirms the final utility list by grepping every file a widget renders (including `src/widgets/alerts-table/**` as reached from the widget) and covering whatever is found; the list above is a starting point, not exhaustive.
- Column widths stay as they are (px, user-resizable); larger text can truncate in narrow columns, which the existing resize handles. No automatic re-layout of the grid.

### UI

**Customize panel** (`DashboardSettingsPanel`), new "Typography" section below Grid density:
- Font: a vertical list, each row set in its own face, with the note from the table above. Selected row uses the panel's existing orange selection style.
- Text size: 5-step segmented control (S, M, L, XL, 2XL) with the live px caption.
- Title size: 3-step segmented control (Normal, Large, XL).
- A small preview line.
- Live on the canvas like the other appearance controls; Cancel reverts the snapshot, "Reset to default" clears typography along with the rest; the toolbar Save persists.

**Edit Widget modal** (`WidgetModal`), new section after the widget-type fields and before "Update Widget", separated by a divider:
- Header row: "Typography" + a Tremor `Switch` labelled "Custom for this widget".
- Off: one grey line — "Uses the dashboard setting: <font> · <size> text · <title> titles. Change it for all widgets in Customize."
- On: Font as a Tremor-style `Select` (each item in its own face), Text size and Title size segmented controls, and an in-modal preview with the widget's name.
- Applied on "Update Widget" like every other modal field; closing the modal discards (my call: no live update of the widget behind the modal, unlike the mock, because the modal's other fields do not preview live either).
- Present for every widget type. For Image, HTML and Grafana Panel the off-line text and the controls are the same, plus one note: "Applies to the title only."

**Edit-mode badge:** a widget with an override shows a small "Custom type" pill in its title row, edit mode only.

### Testing

- Jest: clamp functions (unknown ids, wrong types, partial objects, arrays), precedence resolver, "defaults produce no attribute".
- RTL: Customize panel typography section (select, reset, cancel); modal section (switch off by default, seeding on switch-on, delete on switch-off, saved value round-trips into `WidgetData`).
- Manual proof on a running stack before review: one dashboard with every widget type at S and at 2XL, in light and dark mode, plus the main alerts page unchanged.
- `npm run typecheck`, `npm run lint`, and the touched Jest suites green.

## Left to the builder

- Exact file layout inside `dashboard-appearance/` and where the font module lives.
- The exact selector list for the scoped stylesheet (from the grep described above).
- Copy polish on labels, as long as the meaning above is kept.
- Whether the panel's font list and the modal's select share one component.

## Process

Local branch `feat/widget-typography` in `.worktrees/widget-typography/keep-ui`, off `origin/dev`. Nothing is pushed and no PR is opened unless asked.
