/**
 * @jest-environment node
 */
// Tests for the `/api/hossted` proxy route: authentication (401 without a
// session), request validation (400), missing upstream config (500), the
// happy-path forward, and upstream failures (502/504).

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { POST } from "../route";

jest.mock("@/auth", () => ({ auth: jest.fn() }));

const mockedAuth = auth as unknown as jest.Mock;
const mockedFetch = jest.fn();

const FAKE_SESSION = { user: { email: "test@example.com" } };
const UPSTREAM_URL = "http://hossted.test/api/integrations";
const UPSTREAM_TOKEN = "upstream-token";

function widgetBody(messageId = "fp-1") {
  return {
    integrationName: "keep",
    type: "alert",
    messageId,
    stream: false,
    payload: { fingerprint: messageId },
    response_type: "html",
  };
}

function proxyReq(id: string | null, body: unknown = widgetBody()) {
  const url = new URL("http://localhost:3000/api/hossted");
  if (id !== null) url.searchParams.set("id", id);
  return new NextRequest(url, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function upstreamJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const originalFetch = global.fetch;
const originalEnv = process.env;

beforeEach(() => {
  mockedAuth.mockReset();
  mockedAuth.mockResolvedValue(FAKE_SESSION);
  mockedFetch.mockReset();
  global.fetch = mockedFetch as unknown as typeof fetch;
  process.env = {
    ...originalEnv,
    HOSSTED_UPSTREAM_URL: UPSTREAM_URL,
    HOSSTED_UPSTREAM_TOKEN: UPSTREAM_TOKEN,
  };
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = originalEnv;
  jest.restoreAllMocks();
});

describe("POST /api/hossted", () => {
  it("returns 401 without a session and never calls upstream", async () => {
    mockedAuth.mockResolvedValue(null);

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(401);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when id is missing", async () => {
    const res = await POST(proxyReq(null));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Missing id" });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not a JSON object", async () => {
    const res = await POST(proxyReq("fp-1", "not json"));

    expect(res.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when id does not match the body's messageId", async () => {
    const res = await POST(proxyReq("fp-1", widgetBody("fp-2")));

    expect(res.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("returns 500 when the upstream is not configured", async () => {
    delete process.env.HOSSTED_UPSTREAM_TOKEN;

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(500);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("forwards the body with the upstream token and returns the response", async () => {
    const upstreamData = { summary: "s", response: "<p>r</p>" };
    mockedFetch.mockResolvedValue(upstreamJson(upstreamData));

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(upstreamData);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe(UPSTREAM_URL);
    expect(init.headers.Authorization).toBe(`Bearer ${UPSTREAM_TOKEN}`);
    expect(JSON.parse(init.body)).toEqual(widgetBody());
  });

  it("passes the upstream's error status and body through", async () => {
    mockedFetch.mockResolvedValue(upstreamJson({ error: "bad token" }, 403));

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "bad token" });
  });

  it("returns 502 when the upstream is unreachable", async () => {
    mockedFetch.mockRejectedValue(new TypeError("fetch failed"));

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "Hossted upstream is unreachable",
    });
  });

  it("returns 504 when the upstream times out", async () => {
    mockedFetch.mockRejectedValue(
      new DOMException("The operation timed out", "TimeoutError")
    );

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(504);
  });

  it("returns 502 when the upstream reply is not JSON", async () => {
    mockedFetch.mockResolvedValue(
      new Response("<html>Bad Gateway</html>", { status: 502 })
    );

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "Hossted upstream returned an invalid response",
    });
  });
});
