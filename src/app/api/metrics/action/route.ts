import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { actionLatency, actionExecutions } from "@/metrics/metrics";
import { isValidAction } from "@/metrics/labels";
import { getMetricsSession, unauthorized, badRequest } from "@/metrics/server";

export async function POST(req: NextRequest) {
  const session = await getMetricsSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { label, latency } = body as { label?: string; latency?: number };

  // Server-side allow-list (cardinality firewall): reject unknown actions.
  if (!isValidAction(label)) {
    return badRequest("Missing or invalid 'label' field");
  }
  if (typeof latency !== "number") {
    return badRequest("Missing or invalid 'latency' field");
  }

  actionLatency.observe({ action: label }, latency);
  actionExecutions.inc({ action: label });

  return NextResponse.json({ ok: true });
}
