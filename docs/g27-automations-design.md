# G27 Automations UI Design

## Direction

The Automations pages follow the existing Workflows experience. They use the same page rhythm, typography, orange accent, filter treatment, table surfaces, empty states, and detail-page action placement. Automations should feel like another Keep resource rather than a separate product surface.

## List page

- Reuse the Workflows search input above the sidebar and card grid.
- Search names and namespaces case-insensitively within returned results. Store `q` in the URL and preserve it through detail/back navigation; do not send it to the upstream API.
- Reuse Workflows' `FacetValue` rows: checkboxes, counts, Only/All shortcuts, compact spacing and section reset controls. Multiple values within a facet use OR; different facets use AND.
- Persist sidebar collapse state in local storage. Preserve selections in URL parameters and retain stale namespace options.
- Match Workflows card padding, responsive grid, orange hover/focus border and clickable content area. Show both state axes and left-aligned last run. Digest appears only on the detail page.
- Facets use repeated URL parameters to retain multiple selections through detail/back navigation. Counts reflect other active facets and search. Filtering and counts operate on the loaded list because the upstream has no multi-select/facet contract; the page labels that scope explicitly. Long option lists include value search.
- Cards use wrapping titles, an automation icon, supporting namespace text, two labeled state badges, and a quiet footer with relative last-run time. Exact timestamps remain accessible by tooltip.
- Distinguish empty data, filtered results and search results, with independent clear actions.
- Browser tests exercise the visible facet controls, combined search/filter behavior, navigation, persisted collapse preference and narrow viewport layout.

## Detail page

- Use the Workflows detail rhythm: back navigation, title block, supporting namespace text, state badges, and actions aligned at the top right.
- Keep Edit, Enable/Disable, and Delete in the same action group. Delete remains visually destructive and keeps the immediate-deletion confirmation warning.
- Show deletion state in a highlighted lifecycle banner so users understand whether new executions are stopped and whether audit records remain.
- Group the automation definition and metadata in consistent bordered cards.
- Display trigger conditions as compact bordered items, definition fields as labeled metadata, and scripts in a dark monospace panel.
- Keep digest, contract version, timestamps, and authors in a responsive metadata grid.

## Interaction and accessibility

- Use text and badges together for all state values; color is supplementary.
- Keep disabled lifecycle controls discoverable with their existing tooltip and reason.
- Preserve keyboard focus states, semantic headings, labeled filters, and descriptive action names.
- Do not add an authoring CTA because authoring belongs to G28 and is out of scope for G27.

## Verification

- Run the Automations component tests and TypeScript checks.
- Verify list filtering, empty states, detail navigation, lifecycle actions, and confirmation dialogs against the local JSON fixture server.
- Check the page at desktop and narrow viewport widths for layout regressions.
