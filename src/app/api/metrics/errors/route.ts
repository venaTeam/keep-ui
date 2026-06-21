import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errors } from "@/metrics/metrics";
import { isValidAction } from "@/metrics/labels";
import { getMetricsSession, unauthorized, badRequest } from "@/metrics/server";

export async function POST(req: NextRequest) {
  const session = await getMetricsSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { action } = body as { action?: string };

  // Server-side allow-list (cardinality firewall): reject unknown actions.
  if (!isValidAction(action)) {
    return badRequest("Missing or invalid 'action' field");
  }

  errors.inc({ action });

  return NextResponse.json({ ok: true });
}
