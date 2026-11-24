import type { Page, Request } from "@playwright/test";
import { test as base, expect } from "../fixtures/test-base";
import {
  AssistantFake,
  conversation,
  draft,
  events,
  refusal,
  stream,
  textStream,
  truncatedStream,
} from "../fixtures/assistant-fake";
import { AssistantPanel } from "../pages";

/**
 * [check:13] assistant
 *
 * The assistant panel, end to end in the browser: opening it, sending the selected
 * alerts along, the draft card and its Confirm and Discard, and recovering from a
 * cut-off answer, a busy conversation and a reload.
 *
 * Needs keep-ui running with KEEP_ASSISTANT_ENABLED=true, and fails saying so without
 * it. The assistant's API is faked in the browser from the golden file the gateway is
 * tested against, so it needs no OpenAI key; the alerts are real.
 */
const test = base.extend<{ assistant: AssistantFake; panel: AssistantPanel }>({
  assistant: async ({ page }, use) => {
    const fake = new AssistantFake(page);
    await fake.install();
    await use(fake);
    expect(fake.unexpected).toEqual([]);
  },
  panel: async ({ page }, use) => {
    await use(new AssistantPanel(page));
  },
});

const QUESTION = "acknowledge these with the note investigating";
const ANSWER = "I drafted the change.";
// Longer than the table waits to read again (ALERT_REFETCH_MAX_WAIT_MS).
const QUIET_MS = 5_000;
const CONVERSATION_ID = events("draft_created")[0][1].conversation_id;

const isAlertsQuery = (request: Request) =>
  request.url().includes("/backend/alerts/query");

/** The table also reads again after alerts come in: until that is over, a new read
 * says nothing about what caused it. */
async function alertsToBeQuiet(page: Page): Promise<void> {
  let last = Date.now();
  const onRequest = (request: Request) => {
    if (isAlertsQuery(request)) last = Date.now();
  };
  page.on("request", onRequest);
  await expect.poll(() => Date.now() - last, { timeout: 60_000 }).toBeGreaterThan(QUIET_MS);
  page.off("request", onRequest);
}

test.describe("[check:13] assistant", () => {
  test("opens and closes with the toggle, the close button and the hotkey", async ({
    page,
    assistant,
    panel,
  }) => {
    await page.goto("/alerts/feed");
    await panel.open();
    await expect(panel.toggle).toHaveAttribute("aria-pressed", "true");

    await panel.closeButton.click();
    await expect(panel.root).toBeHidden();
    await expect(panel.toggle).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("ControlOrMeta+j");
    await expect(panel.root).toBeVisible();
    // Also while typing.
    await panel.input.click();
    await page.keyboard.press("ControlOrMeta+j");
    await expect(panel.root).toBeHidden();

    await panel.toggle.click();
    await expect(panel.root).toBeVisible();
    await panel.toggle.click();
    await expect(panel.root).toBeHidden();
    expect(assistant.chats).toEqual([]);
  });

  test("drafts for the selected alerts, and Confirm saves and refreshes them", async ({
    page,
    api,
    alertsFeed,
    assistant,
    panel,
  }) => {
    const stamp = Date.now();
    const seeds = await Promise.all(
      [1, 2].map((n) =>
        api.alerts.sendAlert({
          name: `sanity-assistant-${stamp}-${n}`,
          fingerprint: `sanity-assistant-${stamp}-${n}`,
        })
      )
    );
    const fingerprints = seeds.map((seed) => seed.fingerprint);
    for (const fingerprint of fingerprints) {
      await api.alerts.waitForAlert(fingerprint);
    }
    await alertsFeed.loadFeed(
      `fingerprint.startsWith("sanity-assistant-${stamp}")`,
      fingerprints
    );
    await panel.open();
    for (const fingerprint of fingerprints) {
      await alertsFeed.row(fingerprint).select();
    }
    await expect(panel.selectionChip).toContainText("2");

    const pending = draft("pending", fingerprints);
    assistant.chatAnswers = [stream("draft_created", pending)];
    assistant.conversation = conversation(QUESTION, { answer: ANSWER, draft: pending });
    await panel.send(QUESTION);

    await panel.expectCard("draft");
    await expect(panel.confirmButton).toHaveText("Acknowledge 2 alerts");
    await expect(panel.card).toContainText("investigating");
    expect(assistant.chats).toHaveLength(1);
    const [chat] = assistant.chats;
    expect(chat.message).toBe(QUESTION);
    expect(chat.conversation_id).toBeNull();
    expect(chat.context.page).toBe("/alerts/feed");
    expect(chat.context.selected_count).toBe(2);
    expect([...chat.context.selected_fingerprints].sort()).toEqual(
      [...fingerprints].sort()
    );

    const applied = draft("applied", fingerprints);
    assistant.confirmAnswer = applied;
    assistant.conversation = conversation(QUESTION, { answer: ANSWER, draft: applied });
    await alertsToBeQuiet(page);
    const refreshed = page.waitForRequest(isAlertsQuery);
    await panel.confirmButton.click();
    await panel.expectCard("saved");
    await refreshed;
    await expect(panel.cardOutcome).toBeVisible();
    await expect(panel.confirmButton).toHaveCount(0);
    await expect(panel.discardButton).toHaveCount(0);
    expect(assistant.confirmed).toEqual([pending.id]);
    // The page itself is still alive behind the card.
    await expect(alertsFeed.row(fingerprints[0]).root).toBeVisible();
  });

  test("a partly applied change says which alerts were not changed", async ({
    page,
    assistant,
    panel,
  }) => {
    const pending = draft("pending");
    const partial = draft("partially_applied");
    assistant.chatAnswers = [stream("draft_created", pending)];
    assistant.conversation = conversation(QUESTION, { answer: ANSWER, draft: pending });
    assistant.confirmAnswer = partial;
    await page.goto("/alerts/feed");
    await panel.open();
    await panel.send(QUESTION);
    await panel.expectCard("draft");

    assistant.conversation = conversation(QUESTION, { answer: ANSWER, draft: partial });
    await panel.confirmButton.click();
    await panel.expectCard("partial");
    await expect(panel.cardOutcome).toContainText("Not changed (1)");
    await expect(panel.cardOutcome).toContainText("Not confirmed (1)");
  });

  test("a draft the user may not make has no Confirm", async ({
    page,
    assistant,
    panel,
  }) => {
    const pending = draft("pending_not_permitted");
    assistant.chatAnswers = [stream("draft_not_permitted", pending)];
    assistant.conversation = conversation(QUESTION, { answer: ANSWER, draft: pending });
    await page.goto("/alerts/feed");
    await panel.open();
    await panel.send(QUESTION);
    await panel.expectCard("not-permitted");
    await expect(panel.cardOutcome).toContainText("permission");
    await expect(panel.confirmButton).toHaveCount(0);
  });

  test("Discard puts the draft away", async ({ page, assistant, panel }) => {
    const pending = draft("pending");
    const discarded = draft("discarded");
    assistant.chatAnswers = [stream("draft_created", pending)];
    assistant.conversation = conversation(QUESTION, { answer: ANSWER, draft: pending });
    assistant.discardAnswer = discarded;
    await page.goto("/alerts/feed");
    await panel.open();
    await panel.send(QUESTION);
    await panel.expectCard("draft");

    assistant.conversation = conversation(QUESTION, {
      answer: ANSWER,
      draft: discarded,
    });
    await panel.discardButton.click();
    await panel.expectCard("declined");
    await expect(panel.confirmButton).toHaveCount(0);
    expect(assistant.discarded).toEqual([pending.id]);
    expect(assistant.confirmed).toEqual([]);
  });

  test("a cut-off answer is read again from the server", async ({
    page,
    assistant,
    panel,
  }) => {
    assistant.chatAnswers = [truncatedStream()];
    assistant.conversation = conversation(QUESTION, {
      answer: "Only half of it",
      answerStatus: "interrupted",
    });
    await page.goto("/alerts/feed");
    await panel.open();
    await panel.send(QUESTION);
    await expect(panel.error).toContainText("interrupted");
    await expect(panel.messages("assistant").last()).toContainText("Only half of it");
    await expect(panel.messages("user")).toHaveCount(1);
    expect(assistant.reads).toContain(CONVERSATION_ID);
    await expect(panel.input).toBeEditable();
  });

  test("a message while another tab's answer runs goes back to the composer", async ({
    page,
    assistant,
    panel,
  }) => {
    assistant.chatAnswers = [textStream("First answer"), refusal("turn_in_progress")];
    assistant.conversation = conversation("first", { answer: "First answer" });
    await page.goto("/alerts/feed");
    await panel.open();
    await panel.send("first");
    await expect(panel.messages("assistant")).toContainText(["First answer"]);

    assistant.conversation = conversation("first", {
      answer: "First answer",
      inProgress: true,
    });
    await panel.send("second");
    await expect.poll(() => assistant.chats.length).toBe(2);
    expect(assistant.chats[1].conversation_id).toBe(CONVERSATION_ID);
    await expect(panel.input).toHaveValue("second");
    await expect(panel.error).toHaveCount(0);

    // The other answer ends: the page finds out by itself.
    const reads = assistant.reads.length;
    assistant.conversation = conversation("first", {
      answer: "The answer of the other tab",
    });
    await expect(panel.messages("assistant").last()).toContainText(
      "The answer of the other tab"
    );
    expect(assistant.reads.length).toBeGreaterThan(reads);
    expect(assistant.chats).toHaveLength(2);
  });

  test("a reload brings the conversation and its draft back", async ({
    page,
    assistant,
    panel,
  }) => {
    const pending = draft("pending");
    assistant.chatAnswers = [stream("draft_created", pending)];
    assistant.conversation = conversation(QUESTION, { answer: ANSWER, draft: pending });
    await page.goto("/alerts/feed");
    await panel.open();
    await panel.send(QUESTION);
    await panel.expectCard("draft");
    await expect(panel.messages("assistant").last()).toContainText(ANSWER);

    await page.reload();
    await panel.open();
    await expect(panel.messages("user")).toContainText([QUESTION]);
    await expect(panel.messages("assistant").last()).toContainText(ANSWER);
    await panel.expectCard("draft");
    await expect(panel.confirmButton).toBeEnabled();
    expect(assistant.chats).toHaveLength(1);
  });

  test("an answer loads nothing from where it points to", async ({
    page,
    assistant,
    panel,
  }) => {
    const foreign: string[] = [];
    await page.route(/example\.invalid/, (route) => {
      foreign.push(route.request().url());
      return route.abort();
    });
    const text =
      "Look ![chart](https://example.invalid/track.png) " +
      '<img src="https://example.invalid/html.png"> and done';
    assistant.chatAnswers = [textStream(text)];
    assistant.conversation = conversation("hi", { answer: text });
    await page.goto("/alerts/feed");
    await panel.open();
    await panel.send("hi");
    const answer = panel.messages("assistant").last();
    await expect(answer).toContainText("and done");
    await expect(answer.locator("img")).toHaveCount(0);
    expect(foreign).toEqual([]);
  });
});
