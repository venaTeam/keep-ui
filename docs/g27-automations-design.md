# G27 Automations UI Design

## Direction

The Automations pages follow the existing Workflows experience. They use the same page rhythm, typography, orange accent, filter treatment, table surfaces, empty states, and detail-page action placement. Automations should feel like another Keep resource rather than a separate product surface.

## List page

- Use the Workflows page header pattern with the title and a short description.
- Place namespace, matching state, and build state controls in a light filter panel with a filter icon and clear action.
- Present results in a bordered table card with a muted header row and hover feedback.
- Make the automation name the primary navigation link; show namespace as supporting text.
- Render matching and build state with the shared state badges, digest in monospace, and last run with a readable relative time plus the full timestamp on focus/hover.
- Use the shared loader, error treatment, and empty-state card. Empty results from filters include a clear-filters action.
- Keep the layout responsive and allow table content to scroll horizontally on narrow screens.

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
- Do not add an authoring CTA because authoring is out of scope for G28.

## Verification

- Run the Automations component tests and TypeScript checks.
- Verify list filtering, empty states, detail navigation, lifecycle actions, and confirmation dialogs against the local JSON fixture server.
- Check the page at desktop and narrow viewport widths for layout regressions.
