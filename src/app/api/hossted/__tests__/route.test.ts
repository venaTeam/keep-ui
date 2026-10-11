/**
 * @jest-environment node
 */
// Tests for the `/api/hossted` proxy route: authentication (401 without a
// session), request validation (400), missing upstream config (500), the
// happy-path forward, redirects, and upstream failures (502/504).
//
// The route talks to the upstream with node's http/https modules, so these
// tests run a real local HTTP server as the upstream instead of mocking fetch.

import http from "http";
import { AddressInfo } from "net";
import { EventEmitter } from "events";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { POST } from "../route";

jest.mock("@/auth", () => ({ auth: jest.fn() }));

const mockedAuth = auth as unknown as jest.Mock;

const FAKE_SESSION = { user: { email: "test@example.com" } };
const UPSTREAM_TOKEN = "upstream-token";

type Seen = { url: string; authorization?: string; body: string };
type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

let server: http.Server;
let upstreamUrl: string;
let seen: Seen[];
let handler: Handler;

function replyJson(data: unknown, status = 200): Handler {
  return (_req, res) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
}

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

const originalEnv = process.env;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      seen.push({
        url: req.url ?? "",
        authorization: req.headers.authorization,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      handler(req, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  upstreamUrl = `http://127.0.0.1:${port}/api/integrations`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  mockedAuth.mockReset();
  mockedAuth.mockResolvedValue(FAKE_SESSION);
  seen = [];
  handler = replyJson({ summary: "s", response: "<p>r</p>" });
  process.env = {
    ...originalEnv,
    HOSSTED_UPSTREAM_URL: upstreamUrl,
    HOSSTED_UPSTREAM_TOKEN: UPSTREAM_TOKEN,
  };
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

describe("POST /api/hossted", () => {
  it("returns 401 without a session and never calls upstream", async () => {
    mockedAuth.mockResolvedValue(null);

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(401);
    expect(seen).toHaveLength(0);
  });

  it("returns 400 when id is missing", async () => {
    const res = await POST(proxyReq(null));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Missing id" });
    expect(seen).toHaveLength(0);
  });

  it("returns 400 when the body is not a JSON object", async () => {
    const res = await POST(proxyReq("fp-1", "not json"));

    expect(res.status).toBe(400);
    expect(seen).toHaveLength(0);
  });

  it("returns 400 when id does not match the body's messageId", async () => {
    const res = await POST(proxyReq("fp-1", widgetBody("fp-2")));

    expect(res.status).toBe(400);
    expect(seen).toHaveLength(0);
  });

  it("returns 500 when the upstream is not configured", async () => {
    delete process.env.HOSSTED_UPSTREAM_TOKEN;

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(500);
    expect(seen).toHaveLength(0);
  });

  it("forwards the body with the upstream token and returns the response", async () => {
    const upstreamData = { summary: "s", response: "<p>r</p>" };
    handler = replyJson(upstreamData);

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(await res.json()).toEqual(upstreamData);
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("/api/integrations");
    expect(seen[0].authorization).toBe(`Bearer ${UPSTREAM_TOKEN}`);
    expect(JSON.parse(seen[0].body)).toEqual(widgetBody());
  });

  it("passes the upstream's error status and body through", async () => {
    handler = replyJson({ error: "bad token" }, 403);

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "bad token" });
  });

  it("passes a non-JSON upstream reply through verbatim", async () => {
    handler = (_req, res) => {
      res.writeHead(502, { "Content-Type": "text/html" });
      res.end("<html>Bad Gateway</html>");
    };

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(502);
    expect(res.headers.get("Content-Type")).toBe("text/html");
    expect(await res.text()).toBe("<html>Bad Gateway</html>");
  });

  it("follows an upstream redirect, re-sending the body and token", async () => {
    const upstreamData = { summary: "moved", response: "<p>r</p>" };
    handler = (req, res) => {
      if (req.url === "/api/integrations") {
        res.writeHead(307, { Location: "/api/v2/integrations" });
        res.end();
        return;
      }
      replyJson(upstreamData)(req, res);
    };

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(upstreamData);
    expect(seen.map((s) => s.url)).toEqual([
      "/api/integrations",
      "/api/v2/integrations",
    ]);
    expect(seen[1].authorization).toBe(`Bearer ${UPSTREAM_TOKEN}`);
    expect(JSON.parse(seen[1].body)).toEqual(widgetBody());
  });

  it("returns 502 when the upstream is unreachable", async () => {
    // Port 1 on loopback: nothing listens there, so the connection is refused.
    process.env.HOSSTED_UPSTREAM_URL = "http://127.0.0.1:1/api/integrations";

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "Hossted upstream is unreachable",
    });
  });

  it("returns 504 when the upstream times out", async () => {
    // Stand in for a socket that never answers: emit node's "timeout" event
    // instead of waiting out the real 60s limit.
    jest.spyOn(http, "request").mockImplementation((() => {
      const fakeReq = new EventEmitter() as EventEmitter & {
        write: jest.Mock;
        end: jest.Mock;
        destroy: jest.Mock;
      };
      fakeReq.write = jest.fn();
      fakeReq.destroy = jest.fn();
      fakeReq.end = jest.fn(() => {
        setImmediate(() => fakeReq.emit("timeout"));
      });
      return fakeReq;
    }) as unknown as typeof http.request);

    const res = await POST(proxyReq("fp-1"));

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ error: "Hossted upstream timed out" });
  });
});
