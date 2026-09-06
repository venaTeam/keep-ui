import type { Session } from "next-auth";

export const SESSION_HEADER = "x-keep-session";

export function serializeSession(session: Session): string {
  return encodeURIComponent(JSON.stringify(session));
}

export function deserializeSession(value: string | null): Session | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(value)) as Session;
  } catch {
    return null;
  }
}
