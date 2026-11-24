/** Where the assistant panel store persists itself. */
export const ASSISTANT_PANEL_STORAGE_KEY = "keep-assistant-panel";

/**
 * Forgets the assistant's conversation ids. Call it wherever the user is
 * signed out, so the next user of the browser does not inherit them.
 */
export function clearAssistantStorage(): void {
  try {
    localStorage.removeItem(ASSISTANT_PANEL_STORAGE_KEY);
  } catch {
    // Storage is unavailable, so there is nothing to forget
  }
}
