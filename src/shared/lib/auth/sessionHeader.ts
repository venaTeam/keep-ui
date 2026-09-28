import type { Session } from "next-auth";

export const SESSION_HEADER = "x-keep-session";

export function serializeSession(session: Session): string {
  return encodeURIComponent(JSON.stringify(session));
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.expires === "string" &&
    typeof candidate.accessToken === "string" &&
    !!candidate.user &&
    typeof candidate.user === "object" &&
    !Array.isArray(candidate.user)
  );
}

export function deserializeSession(value: string | null): Session | null {
  if (!value) {
    return null;
  }

  try {
    const session: unknown = JSON.parse(decodeURIComponent(value));
    return isSession(session) ? session : null;
  } catch {
    return null;
  }
}

export async function resolveSessionFromHeader(
  value: string | null,
  fallback: () => Promise<Session | null>
): Promise<Session | null> {
  return deserializeSession(value) ?? fallback();
}
