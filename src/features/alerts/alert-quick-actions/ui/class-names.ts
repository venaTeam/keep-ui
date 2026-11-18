import "./quick-actions.css";

/** Class on the widget's table wrapper that scopes the quick-action styles; the wrapper carries `data-selecting` while anything is ticked. */
export const QUICK_ACTIONS_TABLE_CLASS = "quick-actions-table";

/** Hidden until its row is hovered or holds keyboard focus (`:focus-visible`), or anything is ticked; focus a dialog restores after a mouse click does not reveal it. */
export const QUICK_REVEAL_CLASS = "quick-reveal";

/** Marks a row checkbox; a row whose checkbox is ticked is highlighted. */
export const QUICK_PICK_CLASS = "quick-pick";

/** Marks the row tray; hidden and unclickable until its row is hovered or holds keyboard focus (`:focus-visible`). */
export const QUICK_TRAY_CLASS = "quick-tray";

/** Attribute on an element inside the row whose dialog is open; that row stays highlighted. */
export const QUICK_OPEN_ATTR = "data-quick-open";
