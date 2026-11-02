import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import http from "http";
import https from "https";
import { createClient, type RedisClientType } from "redis";

// Our own backend proxy for @hossted/keep-integration. The widget cannot talk
// to Hossted directly (no safe place to hold HOSSTED_UPSTREAM_TOKEN in the
// browser), so it POSTs here, and this route forwards to Hossted with the
// real token attached.
//
// Every POST is sent to Hossted and its reply goes straight back to the widget.
// A successful answer is also stored in Redis in the background, under the
// tenant and the alert fingerprint, and GET returns the stored answer (or 404)
// so the Keep UI can show an earlier analysis when a page loads. Redis is only
// a convenience: if it is not configured, slow or down, POST is not delayed,
// nothing is stored, and GET returns 404 as if nothing had been stored.

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

let redisClient: RedisClientType | null = null;
let redisConnecting: Promise<RedisClientType> | null = null;

async function getRedis(): Promise<RedisClientType | null> {
  const url = process.env.HOSSTED_REDIS_URL;
  if (!url) return null;
  if (redisClient?.isOpen) return redisClient;
  if (!redisConnecting) {
    // Without these two options the client retries the connection forever
    // and the request never reaches Hossted. A failed connection is retried
    // by the next request.
    const client: RedisClientType = createClient({
      url,
      socket: { connectTimeout: 2000, reconnectStrategy: false },
    });
    client.on("error", () => {});
    redisConnecting = client
      .connect()
      .then(() => {
        redisClient = client;
        return client;
      })
      .finally(() => {
        redisConnecting = null;
      });
  }
  return redisConnecting;
}

const cacheKey = (tenantId: string, id: string) =>
  `hossted:response:${tenantId}:${id}`;

// Longest wait for Redis before giving up. HOSSTED_REDIS_TIMEOUT_MS overrides it.
const redisTimeoutMs = () => Number(process.env.HOSSTED_REDIS_TIMEOUT_MS) || 2000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Redis did not answer in time")),
      redisTimeoutMs()
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function storeAnswer(key: string, answer: string) {
  const redis = await getRedis();
  await redis?.set(key, answer, { EX: CACHE_TTL_SECONDS });
}

async function readAnswer(key: string) {
  const redis = await getRedis();
  return redis ? await redis.get(key) : null;
}

// /api/* bypasses the auth middleware (see src/middleware.ts matcher), so the
// session is checked here - otherwise anyone who can reach the UI could spend
// the upstream token.

const UPSTREAM_TIMEOUT_MS = 60_000;

class UnsafeRedirectError extends Error {}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

type HosstedResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: http.IncomingHttpHeaders;
  text: () => string;
  json: () => Promise<unknown>;
};

function hosstedRequest(
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body: string;
    timeout: number;
  },
  redirectCount = 0
): Promise<HosstedResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const requestModule = isHttps ? https : http;
    // Allow calling HTTPS upstreams that present certificates the pod does not
    // trust when NODE_TLS_REJECT_UNAUTHORIZED=0 is set (e.g. internal CA).
    const rejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0";
    const agent = isHttps ? new https.Agent({ rejectUnauthorized }) : undefined;

    const req = requestModule.request(
      url,
      {
        method: options.method,
        headers: options.headers,
        agent,
        timeout: options.timeout,
      },
      (res) => {
        const status = res.statusCode ?? 0;

        if (
          status >= 300 &&
          status < 400 &&
          res.headers.location &&
          redirectCount < 5
        ) {
          // Never send the upstream token or alert payload to another origin,
          // including an HTTPS-to-HTTP downgrade. Check every redirect hop.
          res.resume();
          let resolvedUrl: URL;
          try {
            resolvedUrl = new URL(res.headers.location, parsed);
          } catch {
            reject(
              new UnsafeRedirectError("Invalid Hossted upstream redirect")
            );
            return;
          }
          if (
            resolvedUrl.origin !== parsed.origin ||
            resolvedUrl.username ||
            resolvedUrl.password
          ) {
            reject(new UnsafeRedirectError("Unsafe Hossted upstream redirect"));
            return;
          }
          hosstedRequest(
            resolvedUrl.toString(),
            options,
            redirectCount + 1
          ).then(resolve, reject);
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          const data = Buffer.concat(chunks).toString("utf8");
          resolve({
            ok: status >= 200 && status < 300,
            status,
            statusText: res.statusMessage ?? "",
            headers: res.headers,
            text: () => data,
            json: async () => JSON.parse(data),
          });
        });
        res.on("error", (error) => reject(error));
      }
    );

    req.on("error", (error) => reject(error));
    req.on("timeout", () => {
      req.destroy();
      const timeoutError = new Error("Hossted upstream request timed out");
      timeoutError.name = "TimeoutError";
      reject(timeoutError);
    });

    req.write(options.body);
    req.end();
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return errorResponse("Unauthorized", 401);
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return errorResponse("Missing id", 400);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("Invalid JSON body", 400);
  }

  // The widget sends the alert fingerprint both as ?id= and as messageId.
  if (body.messageId !== id) {
    return errorResponse("id does not match messageId", 400);
  }

  const upstreamUrl = process.env.HOSSTED_UPSTREAM_URL;
  const upstreamToken = process.env.HOSSTED_UPSTREAM_TOKEN;
  if (!upstreamUrl || !upstreamToken) {
    return errorResponse("Hossted upstream is not configured", 500);
  }

  const key = cacheKey(session.user?.tenantId ?? "default", id);

  let upstreamRes: HosstedResponse;
  try {
    upstreamRes = await hosstedRequest(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${upstreamToken}`,
      },
      body: JSON.stringify(body),
      timeout: UPSTREAM_TIMEOUT_MS,
    });
  } catch (error) {
    if (error instanceof UnsafeRedirectError) {
      return errorResponse("Hossted upstream redirect is not allowed", 502);
    }
    const errorName = (error as { name?: string } | null)?.name;
    const isTimeout =
      errorName === "TimeoutError" || errorName === "AbortError";
    console.error("Hossted upstream request failed", error);
    return isTimeout
      ? errorResponse("Hossted upstream timed out", 504)
      : errorResponse("Hossted upstream is unreachable", 502);
  }

  // Forward the upstream response as transparently as possible. If Hossted
  // returns an error with a non-JSON body, returning it verbatim is more
  // useful than masking it behind a generic 502.
  const upstreamBody = upstreamRes.text();
  const responseHeaders = new Headers();
  const contentType = upstreamRes.headers["content-type"];
  if (contentType) {
    responseHeaders.set("Content-Type", contentType);
  }

  // Only answers the widget treats as a success are stored. The reply below
  // does not wait for Redis.
  if (upstreamRes.ok) {
    try {
      const parsed = JSON.parse(upstreamBody);
      if (parsed?.summary && parsed?.response) {
        withTimeout(storeAnswer(key, upstreamBody)).catch((error) =>
          console.error("Hossted proxy: failed to store the answer", error)
        );
      }
    } catch (error) {
      console.error("Hossted proxy: failed to store the answer", error);
    }
  }

  return new NextResponse(upstreamBody, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return errorResponse("Unauthorized", 401);
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return errorResponse("Missing id", 400);
  }

  try {
    const stored = await withTimeout(
      readAnswer(cacheKey(session.user?.tenantId ?? "default", id))
    );
    if (stored) {
      return new NextResponse(stored, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Hossted proxy: failed to read the stored answer", error);
  }
  return errorResponse("Not found", 404);
}
