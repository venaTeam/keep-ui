import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// Our own backend proxy for @hossted/keep-integration. The widget cannot talk
// to Hossted directly (no safe place to hold HOSSTED_UPSTREAM_TOKEN in the
// browser), so it POSTs here, and this route forwards to Hossted with the
// real token attached. Nothing is cached: every request goes to Hossted.

// /api/* bypasses the auth middleware (see src/middleware.ts matcher), so the
// session is checked here — otherwise anyone who can reach the UI could spend
// the upstream token.

const UPSTREAM_TIMEOUT_MS = 60_000;

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
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

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${upstreamToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
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

  const data = await upstreamRes.json().catch(() => null);
  if (data === null) {
    return errorResponse("Hossted upstream returned an invalid response", 502);
  }

  return NextResponse.json(data, { status: upstreamRes.status });
}
