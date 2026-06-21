// Shared server-side helpers for the `/api/metrics/*` ingestion routes:
// authentication and consistent error responses.
import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Returns the authenticated session, or null when there is no session.
export async function getMetricsSession() {
  return await auth();
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

// Scrape-endpoint protection for `GET /api/metrics`.
//
// The scrape endpoint cannot use a NextAuth session (the collector has no
// browser session), so it is gated by a shared bearer token. When
// `KEEP_METRICS_SCRAPE_TOKEN` is unset the endpoint stays open — this preserves
// local development and the documented `curl localhost:3000/api/metrics`
// verification while allowing production to lock the endpoint down.
export function isAuthorizedScrape(req: { headers: Headers }): boolean {
  const token = process.env.KEEP_METRICS_SCRAPE_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}
