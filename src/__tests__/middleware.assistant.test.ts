/**
 * @jest-environment node
 */
import { once } from "events";
import { readdirSync, readFileSync } from "fs";
import {
  createServer,
  request as sendRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
} from "http";
import type { AddressInfo } from "net";
import path from "path";
import { parse } from "url";
import { NextRequest } from "next/server";
import { proxyRequest } from "next/dist/server/lib/router-utils/proxy-request";
import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";

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

const GATEWAY_URL = "http://gateway.internal:8080";
const WORKFLOWS_URL = "http://workflows.internal:8080";

const run = (
  pathname: string,
  headers: Record<string, string> = {},
  method = "POST"
) =>
  middleware(
    new NextRequest(`http://keep.example.com${pathname}`, { method, headers }),
    {} as never
  ) as Promise<Response>;

const rewrittenTo = (response: Response) =>
  response.headers.get("x-middleware-rewrite");

const setEnv = (env: Record<string, string>) =>
  jest.replaceProperty(process, "env", {
    ...process.env,
    API_URL: GATEWAY_URL,
    WORKFLOWS_API_URL: WORKFLOWS_URL,
    ...env,
  });

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  setEnv({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("middleware /backend/assistant", () => {
  it.each([
    ["POST", "/backend/assistant/chat", "/assistant/chat"],
    [
      "GET",
      "/backend/assistant/conversations/1?limit=2",
      "/assistant/conversations/1?limit=2",
    ],
    [
      "POST",
      "/backend/assistant/drafts/1/confirm",
      "/assistant/drafts/1/confirm",
    ],
    ["POST", "/backend/assistant", "/assistant"],
    // Not the workflows service
    ["GET", "/backend/assistant/workflows", "/assistant/workflows"],
  ])("rewrites %s %s to API_URL", async (method, path, expected) => {
    const response = await run(path, {}, method);

    expect(rewrittenTo(response)).toBe(`${GATEWAY_URL}${expected}`);
  });

  it.each(["production", "development"])(
    "needs no other setting in %s",
    async (NODE_ENV) => {
      setEnv({ NODE_ENV });

      expect(rewrittenTo(await run("/backend/assistant/chat"))).toBe(
        `${GATEWAY_URL}/assistant/chat`
      );
    }
  );

  // Without these headers Next proxies the request with the headers it has
  it("leaves the request headers alone, Authorization among them", async () => {
    const response = await run("/backend/assistant/chat", {
      authorization: "Bearer caller-token",
      "content-type": "application/json",
      accept: "text/event-stream",
    });

    expect(
      Array.from(response.headers.keys()).filter(
        (name) =>
          name === "x-middleware-override-headers" ||
          name.startsWith("x-middleware-request-")
      )
    ).toEqual([]);
  });

  it.each([
    "/backend/assistant/chat",
    "/backend/assistantx/chat",
    "/backend/alerts/assistant",
    "/backend/alerts",
  ])("treats %s as any other gateway path", async (path) => {
    const response = await run(path, { cookie: "a=b" });

    expect(Object.fromEntries(response.headers)).toEqual({
      "x-middleware-rewrite": path.replace("/backend", GATEWAY_URL),
      "set-cookie": mockSessionCookie,
    });
  });

  it.each([
    ["/backend/workflows", `${WORKFLOWS_URL}/workflows`],
    ["/backend/workflows/1/run?x=1", `${WORKFLOWS_URL}/workflows/1/run?x=1`],
  ])("leaves %s going to the workflows service", async (path, expected) => {
    expect(rewrittenTo(await run(path))).toBe(expected);
  });
});

describe("a chat proxied the way Next does it", () => {
  const compression = jest.requireActual("next/dist/compiled/compression");
  const [first, ...rest] = golden.streams.draft_created.raw.split(/(?<=\n\n)/);
  const body = JSON.stringify({ message: "hello" });

  const servers: Server[] = [];
  const listen = async (server: Server) => {
    servers.push(server.listen(0, "127.0.0.1"));
    await once(server, "listening");
    return (server.address() as AddressInfo).port;
  };

  afterEach(() => {
    for (const server of servers.splice(0)) {
      server.closeAllConnections();
      server.close();
    }
  });

  /** A gateway that sends the rest of its answer when it is told to. */
  const startGateway = async () => {
    const received: {
      url?: string;
      method?: string;
      headers?: IncomingHttpHeaders;
      body?: string;
    } = {};
    let sendRest: () => void = () => {};
    const port = await listen(
      createServer(async (req, res) => {
        received.method = req.method;
        received.url = req.url;
        received.headers = req.headers;
        received.body = "";
        for await (const chunk of req) {
          received.body += chunk;
        }
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          "x-accel-buffering": "no",
        });
        res.write(first);
        sendRest = () => res.end(rest.join(""));
      })
    );
    setEnv({ API_URL: `http://127.0.0.1:${port}` });
    return { received, sendRest: () => sendRest() };
  };

  /** Next's router server: compression, the middleware, then its proxy. */
  const startNext = () =>
    listen(
      createServer(async (req, res) => {
        compression()(req, res, () => {});
        const response = await run(
          req.url as string,
          req.headers as Record<string, string>,
          req.method
        );
        const target = parse(rewrittenTo(response) as string, true);
        await proxyRequest(req, res, target as never);
      })
    );

  it("reaches API_URL with its token, and streams unbuffered", async () => {
    const { received, sendRest } = await startGateway();
    const port = await startNext();

    const request = sendRequest({
      port,
      host: "127.0.0.1",
      method: "POST",
      path: "/backend/assistant/chat",
      headers: {
        authorization: "Bearer caller-token",
        "content-type": "application/json",
        accept: "text/event-stream",
        // What makes Next compress, which would hold back the events
        "accept-encoding": "gzip, deflate, br",
      },
    });
    request.end(body);
    const [response] = (await once(request, "response")) as [IncomingMessage];
    response.setEncoding("utf8");

    // The rest has not been sent yet
    const [received1] = await once(response, "data");
    expect(received1).toBe(first);

    sendRest();
    let received2 = "";
    for await (const chunk of response) {
      received2 += chunk;
    }
    expect(received2).toBe(rest.join(""));

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/event-stream");
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(received).toMatchObject({
      method: "POST",
      url: "/assistant/chat",
      headers: {
        authorization: "Bearer caller-token",
        accept: "text/event-stream",
        "content-type": "application/json",
      },
      body,
    });
  });
});

it("has no other assistant URL anywhere", () => {
  const root = path.join(__dirname, "../..");
  const sources = readdirSync(path.join(root, "src"), {
    recursive: true,
    encoding: "utf8",
  })
    .filter((file) => /\.(tsx?|m?jsx?)$/.test(file))
    .filter((file) => !file.includes("__tests__"))
    .map((file) => path.join("src", file));
  expect(sources.length).toBeGreaterThan(500);

  expect(
    [
      ...sources,
      "entrypoint.sh",
      "Dockerfile",
      "next.config.js",
      ".env",
    ].filter((file) =>
      readFileSync(path.join(root, file), "utf8").includes("ASSISTANT_API_URL")
    )
  ).toEqual([]);
});
