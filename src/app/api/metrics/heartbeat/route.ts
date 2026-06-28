import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { activeUsers } from "@/metrics/metrics";
import { getMetricsSession, unauthorized, badRequest } from "@/metrics/server";

const userHeartbeats = new Map<string, number>();

const HEARTBEAT_TIMEOUT_MS = 60_000;
const CLEANUP_INTERVAL_MS = 30_000;

let cleanupStarted = false;

function startCleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    let removed = 0;
    for (const [userId, lastSeen] of userHeartbeats) {
      if (now - lastSeen > HEARTBEAT_TIMEOUT_MS) {
        userHeartbeats.delete(userId);
        removed++;
      }
    }
    if (removed > 0) {
      activeUsers.dec(removed);
      console.log(`[metrics] heartbeat cleanup removed ${removed} inactive users`);
    }
  }, CLEANUP_INTERVAL_MS);
}

// NOTE: this in-memory heartbeat tracking is replica-unsafe and is slated for
// replacement by the SSE-driven connected-users gauge (Phase 1). For now it is
// at least authenticated so it cannot be driven by anonymous callers.
export async function POST(req: NextRequest) {
  const session = await getMetricsSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { userId } = body as { userId?: string };

  if (!userId) {
    return badRequest("Missing userId");
  }

  const isNew = !userHeartbeats.has(userId);
  userHeartbeats.set(userId, Date.now());

  if (isNew) {
    activeUsers.inc();
    console.log(`[metrics] heartbeat: new user registered, now ${userHeartbeats.size} active`);
  }

  startCleanup();

  return NextResponse.json({ ok: true, activeUsers: userHeartbeats.size });
}
