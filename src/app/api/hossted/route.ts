import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import http from "http";
import https from "https";

// Our own backend proxy for @hossted/keep-integration. The widget cannot talk
// to Hossted directly (no safe place to hold HOSSTED_UPSTREAM_TOKEN in the
// browser), so it POSTs here, and this route forwards to Hossted with the
// real token attached. Nothing is cached: every request goes to Hossted.

// /api/* bypasses the auth middleware (see src/middleware.ts matcher), so the
// session is checked here - otherwise anyone who can reach the UI could spend
// the upstream token.

const UPSTREAM_TIMEOUT_MS = 60_000;

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
    const agent = isHttps
      ? new https.Agent({ rejectUnauthorized })
      : undefined;

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
          const resolvedUrl = new URL(res.headers.location, url).toString();
          hosstedRequest(resolvedUrl, options, redirectCount + 1).then(
            resolve,
            reject
          );
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

  return new NextResponse(upstreamBody, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: responseHeaders,
  });
}
