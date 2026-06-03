# Alert Count Panel Query Optimization

## Intro

### The problem

Dashboard alert-count widgets currently create more alert query traffic than the UI needs. Each `WidgetAlertCountPanel` can request both total alerts and firing-only alerts even though it displays only one of those values. The parent `PresetGridItem` also performs alert fetching before deciding whether the widget is an alert table or an alert-count panel, which can add another unnecessary request for count-panel widgets.

This makes dashboards slow to load and keeps applying pressure every refresh interval. A dashboard with several alert-count panels can repeatedly generate unnecessary `/alerts/query` POST requests and database work, affecting both dashboard users and other operations sharing the same database.

### Why we got this assignment

The issue was raised because alert-count dashboards are producing visible performance problems: slow initial loads, continuous 10-second polling traffic, and database contention. The immediate assignment is to reduce duplicate widget requests while preserving the existing dashboard behavior for both "Total Alerts" and "Firing Alerts" display modes.

## Requirements

### Functional requirements

1. Each alert-count dashboard widget must fetch only the count mode it displays.
2. `showFiringOnly=false` must continue counting all alerts matching the preset CEL and dashboard time range.
3. `showFiringOnly=true` must continue counting only firing alerts matching the preset CEL and dashboard time range.
4. Threshold colors must continue using the same count shown in the widget.
5. Alert-table preset widgets must continue rendering their alert rows and count text.
6. Alert-count widgets must not trigger table-specific alert fetching from `PresetGridItem`.
7. Dashboard time range filtering from the `time_stamp` query parameter must keep applying to widget count requests.
8. Existing navigation from the widget to the preset page and custom link behavior must remain unchanged.
9. The implementation must preserve React hook rules.

### Non-functional requirements

1. Reduce request volume for alert-count widgets from multiple POSTs per widget refresh to one count request per widget refresh.
2. Avoid increasing backend load for alert-table widgets.
3. Keep the first change small enough to ship safely as a performance fix.
4. Preserve backward compatibility for existing dashboard widget configuration.
5. Avoid new polling behavior that can revalidate hidden, disabled, or irrelevant widget queries.
6. Prefer observable, testable behavior: request counts should be verifiable in the browser Network tab and, if available, backend request logs.

## Proposed Implementation

### Option 1: Minimal Frontend Hotfix

Change `WidgetAlertCountPanel` to call `usePresetAlertsCount` once, passing `showFiringOnly` directly. Also stop `PresetGridItem` from enabling its existing `usePresetAlertsCount` call for `ALERT_COUNT_PANEL` widgets by using the hook's existing `enabled` parameter.

Trade-offs:
- Pros: Ships quickly; removes the duplicate total/firing request; can stop the extra parent request with a small change.
- Cons: Leaves table-specific fetching inside `PresetGridItem`; count panels still use the general `/alerts/query` endpoint even though they only need a number.
- Complexity / risk / cost / time: Low complexity, low risk, fastest delivery.

**Best when:** The team needs an immediate performance hotfix with the smallest possible diff.

### Option 2: Component Ownership Plus Count-Only Endpoint

Extract the alert-table fetch and rendering path into a table-specific child component, for example `PresetAlertTablePanel`. Keep `PresetGridItem` responsible only for choosing which widget type to render. Make `WidgetAlertCountPanel` own one count request for the displayed mode, and switch that request to a count-only hook that POSTs to `/alerts/query/count`.

Trade-offs:
- Pros: Gives each widget type clear fetch ownership; removes irrelevant parent polling; makes count widgets request only the count they display; uses the existing API gateway count endpoint.
- Cons: Requires more code movement than the hotfix; requires parity checks for `/alerts/query/count` against dashboard CEL and time range filters.
- Complexity / risk / cost / time: Medium complexity, good performance payoff, moderate review surface.

**Best when:** The team wants the right fix for the current issue without redesigning dashboard polling or backend APIs.

### Recommendation

Choose Option 2 for the main implementation. It fixes the duplicate frontend requests, keeps data fetching in the component that needs the data, and moves alert-count widgets to the existing count-only API path.

Use Option 1 only as a short-term hotfix.

### Verification

1. Open a dashboard with alert-count widgets and filter Network requests for `/alerts/query` and `/alerts/query/count`.
2. Confirm each alert-count widget sends one count request per 10-second refresh interval.
3. Confirm `showFiringOnly=false` counts all alerts matching the preset CEL and dashboard time range.
4. Confirm `showFiringOnly=true` adds `status == 'firing'` and still applies the preset CEL and dashboard time range.
5. Confirm alert-table widgets still render alert rows and count text.
6. Run `npm run lint` and any existing dashboard or preset widget tests.

## Summary

- **Chosen approach:** Use Option 2: extract table-specific fetching, make `WidgetAlertCountPanel` issue one count request for the displayed mode, and use `/alerts/query/count` for count-only widgets.
- **Key decisions:** Widget type controls data fetching; count panels do not fetch both total and firing counts; count-only UI uses a count-only API; the 10-second refresh interval stays unchanged for this story.
