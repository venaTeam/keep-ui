import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isValidPage } from "@/metrics/labels";
import { getMetricsSession, unauthorized, badRequest } from "@/metrics/server";
import { getApiURL } from "@/utils/apiUrl";

// Page views moved server-side (BI Phase 2): keep_ui_page_loads_total now lives
// on the gateway. The client beacon is unchanged; this route validates the
// bounded route label and forwards it (with the user's token) to the gateway's
// POST /ui/page-view, which owns the counter.
export async function POST(req: NextRequest) {
  const session = await getMetricsSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { label } = body as { label?: string };

  if (!isValidPage(label)) {
    return badRequest("Missing or invalid 'label' field");
  }

  try {
    await fetch(`${getApiURL()}/ui/page-view`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(session as any).accessToken}`,
        "X-Keep-Source": "ui",
      },
      body: JSON.stringify({ route: label }),
    });
  } catch {
    // Fire-and-forget: metrics must never affect the user.
  }

  return NextResponse.json({ ok: true });
}
