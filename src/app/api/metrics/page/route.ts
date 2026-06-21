import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { pageloads } from "@/metrics/metrics";
import { isValidPage } from "@/metrics/labels";
import { getMetricsSession, unauthorized, badRequest } from "@/metrics/server";

export async function POST(req: NextRequest) {
  const session = await getMetricsSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { label } = body as { label?: string };

  // Server-side allow-list (cardinality firewall): reject unknown pages.
  if (!isValidPage(label)) {
    return badRequest("Missing or invalid 'label' field");
  }

  // No per-session dedup and no zero-latency observation: count every load.
  pageloads.inc({ page: label });

  return NextResponse.json({ ok: true });
}
