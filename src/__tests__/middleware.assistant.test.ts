/**
 * @jest-environment node
 */
import { NextRequest, type NextFetchEvent } from "next/server";

const mockSessionCookie = "authjs.session-token=refreshed; Path=/; HttpOnly";

// next-auth is ESM and cannot be loaded by jest. This stands in for its
// middleware wrapper, including the refreshed session cookie it appends to
// every response.
jest.mock("next-auth", () => ({
  __esModule: true,
  default: () => ({
    auth:
      (handler: (request: unknown) => Promise<Response>) =>
      async (request: unknown) => {
        const augmented = request as { auth?: unknown };
        augmented.auth = {
          user: { email: "user@example.com" },
          accessToken: "session-token",
          expires: "2099-01-01",
          userRole: "admin",
        };
        const response = await handler(augmented);
        const final = new Response(response.body, response);
        final.headers.append("set-cookie", mockSessionCookie);
        return final;
      },
  }),
}));
jest.mock("@/auth.config", () => ({ config: {} }));

import { middleware } from "@/middleware";

const ASSISTANT_URL = "http://assistant.internal:8080";
const GATEWAY_URL = "http://gateway.internal:8080";
const WORKFLOWS_URL = "http://workflows.internal:8080";
const ALLOWED_HEADERS = [
  "accept",
  "authorization",
  "content-length",
  "content-type",
];

const run = (path: string, headers: Record<string, string> = {}) =>
  middleware(
    new NextRequest(`http://keep.example.com${path}`, {
      method: "POST",
      headers,
    }),
    {} as NextFetchEvent
  ) as Promise<Response>;

const rewrittenTo = (response: Response) =>
  response.headers.get("x-middleware-rewrite");

const forwardedHeaders = (response: Response) =>
  (response.headers.get("x-middleware-override-headers") ?? "")
    .split(",")
    .filter(Boolean)
    .sort();

describe("middleware /backend/assistant", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.replaceProperty(process, "env", {
      ...process.env,
      API_URL: GATEWAY_URL,
      WORKFLOWS_API_URL: WORKFLOWS_URL,
      ASSISTANT_API_URL: ASSISTANT_URL,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["/backend/assistant", `${ASSISTANT_URL}/assistant`],
    ["/backend/assistant/chat", `${ASSISTANT_URL}/assistant/chat`],
    [
      "/backend/assistant/conversations/1?limit=2",
      `${ASSISTANT_URL}/assistant/conversations/1?limit=2`,
    ],
  ])("rewrites %s to %s", async (path, expected) => {
    expect(rewrittenTo(await run(path))).toBe(expected);
  });

  it("forwards only the allowlisted headers, with their values", async () => {
    const response = await run("/backend/assistant/chat", {
      authorization: "Bearer caller-token",
      "content-type": "application/json",
      accept: "text/event-stream",
      "content-length": "12",
      cookie: "authjs.session-token=secret",
      "x-keep-session": "forged",
      "x-api-key": "key",
      "x-keep-user": "someone@example.com",
      "x-keep-source": "ui",
      "x-forwarded-for": "10.0.0.1",
    });

    expect(forwardedHeaders(response)).toEqual(ALLOWED_HEADERS);
    expect(response.headers.get("x-middleware-request-authorization")).toBe(
      "Bearer caller-token"
    );
    expect(response.headers.get("x-middleware-request-accept")).toBe(
      "text/event-stream"
    );
    expect(response.headers.get("x-middleware-request-content-type")).toBe(
      "application/json"
    );
    expect(response.headers.get("x-middleware-request-content-length")).toBe(
      "12"
    );
  });

  it.each(["cookie", "x-keep-session", "x-api-key", "x-keep-user"])(
    "never forwards %s",
    async (name) => {
      const response = await run("/backend/assistant/chat", {
        authorization: "Bearer caller-token",
        [name]: "secret",
      });

      expect(forwardedHeaders(response)).toEqual(["authorization"]);
      expect(response.headers.get(`x-middleware-request-${name}`)).toBeNull();
    }
  );

  // Next copies every middleware response header onto the proxied request, so
  // any header besides its own control headers would reach keep-assistant.
  it("leaves only Next's control headers on the response", async () => {
    const response = await run("/backend/assistant/chat", {
      authorization: "Bearer caller-token",
    });

    expect(Array.from(response.headers.keys()).sort()).toEqual([
      "x-middleware-override-headers",
      "x-middleware-request-authorization",
      "x-middleware-rewrite",
    ]);
  });

  it("ignores the gateway and workflows URLs", async () => {
    const target = rewrittenTo(await run("/backend/assistant/workflows"));

    expect(target).toBe(`${ASSISTANT_URL}/assistant/workflows`);
  });

  describe("without ASSISTANT_API_URL", () => {
    beforeEach(() => {
      delete process.env.ASSISTANT_API_URL;
    });

    it("answers 503 JSON in production and never proxies", async () => {
      Object.assign(process.env, { NODE_ENV: "production" });

      const response = await run("/backend/assistant/chat", {
        authorization: "Bearer caller-token",
      });

      expect(response.status).toBe(503);
      expect(response.headers.get("content-type")).toContain(
        "application/json"
      );
      expect(rewrittenTo(response)).toBeNull();
      expect(await response.json()).toEqual({
        errors: [
          {
            field: null,
            code: "assistant_not_configured",
            message: expect.any(String),
          },
        ],
        detail: expect.any(String),
      });
    });

    it("falls back to the local service outside production", async () => {
      Object.assign(process.env, { NODE_ENV: "development" });

      expect(rewrittenTo(await run("/backend/assistant/chat"))).toBe(
        "http://localhost:8086/assistant/chat"
      );
    });

    it("leaves the other backend paths working in production", async () => {
      Object.assign(process.env, { NODE_ENV: "production" });

      expect(rewrittenTo(await run("/backend/alerts"))).toBe(
        `${GATEWAY_URL}/alerts`
      );
    });
  });

  it.each([
    ["/backend/assistantx", `${GATEWAY_URL}/assistantx`],
    ["/backend/assistantx/chat", `${GATEWAY_URL}/assistantx/chat`],
    ["/backend/alerts/assistant", `${GATEWAY_URL}/alerts/assistant`],
    ["/backend/workflows", `${WORKFLOWS_URL}/workflows`],
    ["/backend/workflows/1/run?x=1", `${WORKFLOWS_URL}/workflows/1/run?x=1`],
  ])("leaves %s going to %s unchanged", async (path, expected) => {
    const response = await run(path, { cookie: "a=b" });

    expect(rewrittenTo(response)).toBe(expected);
    expect(forwardedHeaders(response)).toEqual([]);
    expect(response.headers.get("set-cookie")).toBe(mockSessionCookie);
  });
});
