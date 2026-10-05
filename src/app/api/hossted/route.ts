import { NextRequest, NextResponse } from "next/server";

// Our own backend proxy for @hossted/keep-integration. The widget cannot talk
// to Hossted directly (no safe place to hold HOSSTED_UPSTREAM_TOKEN in the
// browser), so it POSTs here, and this route forwards to Hossted with the
// real token attached. Nothing is cached: every request goes to Hossted.

export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const upstreamUrl = process.env.HOSSTED_UPSTREAM_URL;
  const upstreamToken = process.env.HOSSTED_UPSTREAM_TOKEN;
  if (!upstreamUrl || !upstreamToken) {
    return NextResponse.json(
      { error: "Hossted upstream is not configured" },
      { status: 500 }
    );
  }

  const body = await req.text();
  const upstreamRes = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${upstreamToken}`,
    },
    body,
  });
  const data = await upstreamRes.json();

  return NextResponse.json(data, { status: upstreamRes.status });
}
