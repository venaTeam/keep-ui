import { expect, type Locator, type Page } from "@playwright/test";

/** What a draft card shows itself as (its data-state). */
export type DraftCardState =
  | "streaming"
  | "submitting"
  | "read-only"
  | "not-permitted"
  | "expired"
  | "draft"
  | "saved"
  | "partial"
  | "error"
  | "declined";

/**
 * Page object for the assistant panel (data-cy="assistant-panel"), which is docked
 * into every page of the app.
 *
 * Locator convention: all locators centralized in the `locators` map; methods
 * reference `this.locators.*` and never build a locator inline.
 */
export class AssistantPanel {
  readonly locators: {
    toggle: Locator;
    root: Locator;
    closeButton: Locator;
    newConversationButton: Locator;
    selectionChip: Locator;
    removeSelectionButton: Locator;
    input: Locator;
    sendButton: Locator;
    messages: (role: "user" | "assistant") => Locator;
    error: Locator;
    card: Locator;
    cardOutcome: Locator;
    confirmButton: Locator;
    discardButton: Locator;
  };

  constructor(readonly page: Page) {
    const root = page.locator('[data-cy="assistant-panel"]');
    const card = root.locator('[data-cy="assistant-draft-card"]');
    this.locators = {
      toggle: page.locator('[data-cy="nav-assistant-toggle"]'),
      root,
      closeButton: root.locator('[data-cy="assistant-panel-close"]'),
      newConversationButton: root.locator('[data-cy="assistant-new-conversation"]'),
      selectionChip: root.locator('[data-cy="assistant-context-chip-selection"]'),
      removeSelectionButton: root.locator('[data-cy="assistant-context-chip-remove"]'),
      input: root.locator('[data-cy="assistant-composer-input"]'),
      sendButton: root.locator('[data-cy="assistant-composer-send"]'),
      messages: (role) =>
        root.locator(`[data-cy="assistant-message"][data-role="${role}"]`),
      error: root.locator('[data-cy="assistant-error"]'),
      card,
      cardOutcome: card.locator('[data-cy="assistant-draft-outcome"]'),
      confirmButton: card.locator('[data-cy="assistant-draft-confirm"]'),
      discardButton: card.locator('[data-cy="assistant-draft-discard"]'),
    };
  }

  get root(): Locator {
    return this.locators.root;
  }

  get toggle(): Locator {
    return this.locators.toggle;
  }

  get closeButton(): Locator {
    return this.locators.closeButton;
  }

  get selectionChip(): Locator {
    return this.locators.selectionChip;
  }

  get input(): Locator {
    return this.locators.input;
  }

  get error(): Locator {
    return this.locators.error;
  }

  get card(): Locator {
    return this.locators.card;
  }

  get cardOutcome(): Locator {
    return this.locators.cardOutcome;
  }

  get confirmButton(): Locator {
    return this.locators.confirmButton;
  }

  get discardButton(): Locator {
    return this.locators.discardButton;
  }

  messages(role: "user" | "assistant"): Locator {
    return this.locators.messages(role);
  }

  /** The panel is behind a flag: without it, say so instead of skipping. */
  async requireEnabled(): Promise<void> {
    await expect(
      this.locators.toggle,
      "No assistant toggle in the navbar. Start keep-ui with KEEP_ASSISTANT_ENABLED=true (and without KEEP_AI_FEATURES_DISABLED)."
    ).toBeVisible();
  }

  async open(): Promise<void> {
    await this.requireEnabled();
    // The button is server-rendered: a click before hydration does nothing.
    await expect(async () => {
      if (!(await this.locators.root.isVisible())) {
        await this.locators.toggle.click();
      }
      await expect(this.locators.root).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await expect(this.locators.input).toBeEditable();
  }

  /** Type a message and send it with Enter. */
  async send(message: string): Promise<void> {
    await this.locators.input.fill(message);
    await this.locators.input.press("Enter");
  }

  async expectCard(state: DraftCardState): Promise<void> {
    await expect(this.locators.card).toHaveAttribute("data-state", state);
  }
}
