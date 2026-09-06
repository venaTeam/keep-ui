import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { globalErrors } from "@/metrics/metrics";
import { getMetricsSession, unauthorized } from "@/metrics/server";

export async function POST(req: NextRequest) {
  const session = await getMetricsSession();
  if (!session) return unauthorized();

  globalErrors.inc();
  return NextResponse.json({ ok: true });
}
