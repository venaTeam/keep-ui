import { NextRequest, NextResponse } from "next/server";
import { register } from "@/metrics/metrics";
import { isAuthorizedScrape } from "@/metrics/server";

export async function GET(req: NextRequest) {
  if (!isAuthorizedScrape(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const metrics = await register.metrics();

  return new NextResponse(metrics, {
    status: 200,
    headers: { "Content-Type": register.contentType },
  });
}
