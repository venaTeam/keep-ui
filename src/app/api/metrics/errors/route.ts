import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errors } from "@/metrics/metrics";
import { isValidAction, normalizeStatusCode } from "@/metrics/labels";
import { getMetricsSession, unauthorized, badRequest } from "@/metrics/server";

export async function POST(req: NextRequest) {
  const session = await getMetricsSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { action, status_code } = body as {
    action?: string;
    status_code?: string | number;
  };

  // Server-side allow-list (cardinality firewall): reject unknown actions.
  if (!isValidAction(action)) {
    return badRequest("Missing or invalid 'action' field");
  }

  // status_code is bounded to the allow-list; unknown codes bucket to "other".
  errors.inc({ action, status_code: normalizeStatusCode(status_code) });

  return NextResponse.json({ ok: true });
}
