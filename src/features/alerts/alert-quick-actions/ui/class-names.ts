import "./quick-actions.css";

/** Class on the widget's table wrapper that scopes the quick-action styles; the wrapper carries `data-selecting` while anything is ticked. */
export const QUICK_ACTIONS_TABLE_CLASS = "quick-actions-table";

/** Hidden until its row is hovered or holds keyboard focus (`:focus-visible`), or anything is ticked; focus a dialog restores after a mouse click does not reveal it. */
export const QUICK_REVEAL_CLASS = "quick-reveal";

/** Marks a row checkbox; a row whose checkbox is ticked is highlighted. */
export const QUICK_PICK_CLASS = "quick-pick";

/** Marks the row tray; transparent and unclickable, but focusable, unless its row carries `QUICK_ACTIVE_ATTR`. */
export const QUICK_TRAY_CLASS = "quick-tray";

/** Attribute on the one row of a widget table whose tray shows; that row is tinted and outlined. */
export const QUICK_ACTIVE_ATTR = "data-quick-active";

/** Attribute on a row that stopped being active because the pointer left the table; its tray and tint fade out. */
export const QUICK_LEAVING_ATTR = "data-quick-leaving";

/** Marks the cell holding the row tray; raised above the next row's cells while the tray shows or fades. */
export const QUICK_TRAY_CELL_CLASS = "quick-tray-cell";

/** Attribute on an element inside the row whose dialog is open; that row stays highlighted. */
export const QUICK_OPEN_ATTR = "data-quick-open";
