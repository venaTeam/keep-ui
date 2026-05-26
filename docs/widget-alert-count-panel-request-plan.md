# Widget Alert Count Panel Request Plan

## Goal

Make each alert-count dashboard panel issue one `/alerts/query` POST request instead of multiple requests, while preserving the existing "Total Alerts" and "Firing Alerts" display modes.

## Current Problem

`WidgetAlertCountPanel` calls `usePresetAlertsCount` twice:

```ts
usePresetAlertsCount(filterCel, false, ...);
usePresetAlertsCount(filterCel, true, ...);
```

Only one result is displayed, based on `showFiringOnly`, so one of these requests is wasted for every panel.

There is also a parent-level source of extra requests: `PresetGridItem` calls `usePresetAlertsCount` before rendering `WidgetAlertCountPanel`, even when the widget is an alert-count panel. That means an alert-count panel can trigger more than the two child requests.

## Milestone 1: Fix The Count Panel Request Path

Change `WidgetAlertCountPanel` to call `usePresetAlertsCount` once, using `showFiringOnly` directly.

```ts
const {
  totalCount: alertsCount,
  isLoading,
} = usePresetAlertsCount(
  filterCel,
  showFiringOnly,
  0,
  0,
  10000
);
```

Then replace the current display and threshold selection:

```ts
const displayCount = showFiringOnly ? firingAlertsCount : totalAlertsCount;
const thresholdCount = showFiringOnly ? firingAlertsCount : totalAlertsCount;
```

with:

```ts
const displayCount = alertsCount;
const thresholdCount = alertsCount;
```

Remove the no-longer-needed `isLoadingTotal`, `isLoadingFiring`, `totalAlertsCount`, and `firingAlertsCount` variables.

Success criteria:

- `WidgetAlertCountPanel` has exactly one `usePresetAlertsCount` call.
- Threshold colors still use the count currently displayed.
- `showFiringOnly=true` still counts only firing alerts.
- `showFiringOnly=false` still counts all alerts matching the preset and time range.

## Milestone 2: Stop Parent Fetches For Count Panels

Refactor `PresetGridItem` so it does not call `usePresetAlertsCount` when rendering an `ALERT_COUNT_PANEL`.

Preferred approach:

- Move table-specific count/query logic into a small child component, for example `PresetAlertTablePanel`.
- Let `PresetGridItem` only choose which panel type to render.
- Keep `usePresetAlertsCount` inside the table panel for alert-table widgets.
- Keep a single `usePresetAlertsCount` call inside `WidgetAlertCountPanel` for alert-count widgets.

Target shape:

```tsx
return (
  <div className="flex flex-col overflow-y-auto gap-2">
    {isAlertTable && (
      <PresetAlertTablePanel
        item={item}
        preset={preset}
        filterCel={filterCel}
      />
    )}

    {isAlertCountPanel && (
      <WidgetAlertCountPanel
        presetName={preset?.name as string}
        showFiringOnly={item.showFiringOnly}
        thresholds={item.thresholds}
        customLink={item.customLink}
      />
    )}
  </div>
);
```

Also remove the unused `background` prop from `WidgetAlertCountPanel` unless it is intentionally needed later.

Success criteria:

- Alert-count panel widgets issue one count request per refresh interval.
- Alert-table widgets continue to fetch their alerts and count as before.
- React hook rules remain valid, with no hooks inside conditional branches in the same component.

## Milestone 3: Verification

Manual verification:

- Open a dashboard with alert-count widgets.
- In browser devtools Network tab, filter for `/backend/alerts/query` or `/alerts/query`.
- Confirm each `WidgetAlertCountPanel` causes exactly one POST every refresh interval.
- Confirm the request payload CEL matches the selected mode:
  - `showFiringOnly=false`: preset CEL plus dashboard time range.
  - `showFiringOnly=true`: `status == 'firing'` plus preset CEL plus dashboard time range.
- Confirm alert-table preset widgets still render alerts and counts correctly.

Automated checks:

- Run `npm run lint` if available and reasonably fast.
- Run any existing dashboard, preset widget, or alert-count related tests.

## Deferred Option

If the UI later needs to display both total and firing counts at the same time, do not restore two independent frontend hook calls. Add a backend batch-count endpoint that accepts multiple count queries in one POST and returns both values, for example `{ total, firing }`.
