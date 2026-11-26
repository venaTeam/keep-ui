import type { Page, Route } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

/** The golden file the gateway's own tests are checked against. */
const golden = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../src/entities/assistant/__fixtures__/assistant_stream.json"
    ),
    "utf-8"
  )
);

type Json = Record<string, any>;

interface Answer {
  status?: number;
  headers?: Record<string, string>;
  body: string;
}

export interface ChatRequestBody {
  conversation_id: string | null;
  message: string;
  context: {
    page: string;
    selected_fingerprints: string[];
    selected_count: number;
  };
}

const HALF_AN_HOUR_MS = 30 * 60 * 1000;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// The golden drafts are examples, each with an id of its own. Here they are one draft
// in different states, and the page finds it by its id.
const DRAFT_ID = golden.drafts.pending.id;

/** The golden drafts expired long ago. */
function refresh(draft: Json): Json {
  const now = Date.now();
  return {
    ...draft,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + HALF_AN_HOUR_MS).toISOString(),
  };
}

/** A golden draft, not expired, about these alerts (the golden ones if none). */
export function draft(name: string, fingerprints: string[] = []): Json {
  const view: Json = { ...refresh(copy(golden.drafts[name])), id: DRAFT_ID };
  if (fingerprints.length === 0) {
    return view;
  }
  const [alert] = view.payload.alerts;
  view.payload = {
    ...view.payload,
    selector: { type: "fingerprints", fingerprints },
    matched_count: fingerprints.length,
    alerts: fingerprints.map((fingerprint) => ({
      ...alert,
      fingerprint,
      name: fingerprint,
    })),
    skipped: [],
    not_found: [],
    unresolvable: [],
  };
  if (view.outcome) {
    const [result] = view.outcome.results;
    view.outcome = {
      ...view.outcome,
      applied_count: fingerprints.length,
      results: fingerprints.map((fingerprint) => ({
        ...result,
        fingerprint,
        name: fingerprint,
      })),
    };
  }
  return view;
}

const frame = ([event, data]: [string, Json]) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** A golden stream's events. */
export function events(name: string): [string, Json][] {
  return golden.streams[name].raw
    .split("\n\n")
    .filter((block: string) => block.startsWith("event: "))
    .map((block: string) => {
      const [event, data] = block.split("\n");
      return [event.slice("event: ".length), JSON.parse(data.slice("data: ".length))];
    });
}

/** A golden stream, with this draft in the place of its own. */
export function stream(name: string, view?: Json): Answer {
  const body = events(name)
    .map(([event, data]): [string, Json] =>
      event === "draft" ? [event, { draft: view ?? refresh(data.draft) }] : [event, data]
    )
    .map(frame)
    // The server's heartbeat is a comment: it must not disturb the parser.
    .join(golden.heartbeat);
  return { headers: golden.response_headers, body };
}

/** The golden stream that ends in the middle of an event, byte for byte. */
export function truncatedStream(): Answer {
  return { headers: golden.response_headers, body: golden.streams.truncated.raw };
}

/** A stream of one answer without a tool call. */
export function textStream(text: string): Answer {
  const [conversation, , , , , , , , done] = events("draft_created");
  return {
    headers: golden.response_headers,
    body: [
      conversation,
      ["text_delta", { message_id: done[1].message_id, delta: text }],
      done,
    ]
      .map((event) => frame(event as [string, Json]))
      .join(""),
  };
}

/** A golden refusal. */
export function refusal(code: string): Answer {
  const { status, headers, body } = golden.errors[code];
  return { status, headers, body: JSON.stringify(body) };
}

const message = (role: string, id: string, content: string, status = "complete") => ({
  type: "message",
  id,
  role,
  content,
  status,
  created_at: new Date().toISOString(),
});

/** The stored conversation after a golden stream. */
export function conversation(
  text: string,
  options: {
    answer?: string;
    answerStatus?: string;
    draft?: Json;
    inProgress?: boolean;
  } = {}
): Json {
  const [[, ids], , , , , , , , [, done]] = events("draft_created");
  return {
    ...copy(golden.conversations.finished),
    has_more: false,
    turn_in_progress: !!options.inProgress,
    items: [
      message("user", ids.user_message_id, text),
      ...(options.draft ? [{ type: "draft", draft: options.draft }] : []),
      ...(options.answer
        ? [message("assistant", done.message_id, options.answer, options.answerStatus)]
        : []),
    ],
  };
}

/**
 * The assistant's API, faked in the browser: no test here needs an LLM or the
 * gateway's assistant. An SSE body arrives in one piece, so one chunk holds many
 * events.
 *
 * Set what it answers, then act. A request that nothing was set for fails the test
 * through `unexpected`.
 */
export class AssistantFake {
  readonly chats: ChatRequestBody[] = [];
  readonly confirmed: string[] = [];
  readonly discarded: string[] = [];
  readonly reads: string[] = [];
  readonly unexpected: string[] = [];

  /** One answer per chat request, in order. */
  chatAnswers: Answer[] = [];
  /** What a conversation looks like now, or a refusal. */
  conversation: Json | Answer | null = null;
  confirmAnswer: Json | null = null;
  discardAnswer: Json | null = null;

  constructor(private readonly page: Page) {}

  async install(): Promise<void> {
    await this.page.route("**/backend/assistant/**", (route) => this.answer(route));
  }

  private async answer(route: Route): Promise<void> {
    const request = route.request();
    const path_ = new URL(request.url()).pathname.replace(/^.*\/backend/, "");
    const [, resource, id, action] = path_.split("/").slice(1);
    const key = `${request.method()} ${path_}`;

    if (key === "POST /assistant/chat") {
      this.chats.push(request.postDataJSON());
      return this.fulfill(route, key, this.chatAnswers.shift());
    }
    if (request.method() === "GET" && resource === "conversations") {
      this.reads.push(id);
      return this.fulfill(route, key, this.conversation);
    }
    if (request.method() === "POST" && resource === "drafts") {
      if (action === "confirm") {
        this.confirmed.push(id);
        return this.fulfill(route, key, this.confirmAnswer);
      }
      if (action === "discard") {
        this.discarded.push(id);
        return this.fulfill(route, key, this.discardAnswer);
      }
    }
    return this.fulfill(route, key, null);
  }

  private async fulfill(
    route: Route,
    key: string,
    answer: Json | Answer | null | undefined
  ): Promise<void> {
    if (!answer) {
      this.unexpected.push(key);
      await route.fulfill({ status: 500, body: "nothing was set for this" });
      return;
    }
    const { status, headers, body } =
      typeof answer.body === "string"
        ? (answer as Answer)
        : { status: 200, headers: {}, body: JSON.stringify(answer) };
    await route.fulfill({
      status: status ?? 200,
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });
  }
}
