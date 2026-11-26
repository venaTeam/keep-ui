// Both are literal strings, so that Tailwind finds every class
const SHELL =
  "h-screen flex flex-col lg:grid lg:grid-cols-[192px_12px_auto] xl:grid-cols-[220px_12px_auto] 2xl:grid-cols-[250px_12px_auto] lg:grid-rows-1 lg:has-[aside[data-minimized='true']]:grid-cols-[0px_12px_auto]";

// A fourth column for the docked panel. It is empty, so 0 wide, while the
// panel is closed or floats over the page.
const SHELL_WITH_ASSISTANT =
  "h-screen flex flex-col lg:grid lg:grid-cols-[192px_12px_minmax(0,1fr)_auto] xl:grid-cols-[220px_12px_minmax(0,1fr)_auto] 2xl:grid-cols-[250px_12px_minmax(0,1fr)_auto] lg:grid-rows-1 lg:has-[aside[data-minimized='true']]:grid-cols-[0px_12px_minmax(0,1fr)_auto]";

/** The classes of the body: the navigation, the page and the panel. */
export function getShellClassName(isAssistantEnabled: boolean): string {
  return isAssistantEnabled ? SHELL_WITH_ASSISTANT : SHELL;
}
