import { NextRequest, NextResponse } from "next/server";
import { createClient, type RedisClientType } from "redis";

// Our own backend proxy for @hossted/keep-integration. The widget cannot talk
// to Hossted directly (no safe place to hold HOSSTED_UPSTREAM_TOKEN in the
// browser), so it POSTs here, and this route forwards to Hossted with the
// real token attached, then caches the result in Redis keyed by id (the
// alert fingerprint) so a page reload can restore it via GET.

let redisClient: RedisClientType | null = null;
let redisConnecting: Promise<RedisClientType> | null = null;

async function getRedis() {
  if (redisClient?.isOpen) return redisClient;
  if (!redisConnecting) {
    const client: RedisClientType = createClient({
      url: process.env.HOSSTED_REDIS_URL,
    });
    redisConnecting = client.connect().then(() => {
      redisClient = client;
      return client;
    });
  }
  return redisConnecting;
}

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const cacheKey = (id: string) => `hossted:response:${id}`;

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

  try {
    const redis = await getRedis();
    await redis.set(cacheKey(id), JSON.stringify(data), {
      EX: CACHE_TTL_SECONDS,
    });
  } catch (err) {
    console.error("Hossted proxy: failed to cache response", err);
  }

  return NextResponse.json(data, { status: upstreamRes.status });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const redis = await getRedis();
    const cached = await redis.get(cacheKey(id));
    if (!cached) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(JSON.parse(cached));
  } catch (err) {
    console.error("Hossted proxy: failed to read cache", err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
