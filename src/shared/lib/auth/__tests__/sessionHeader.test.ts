import type { Session } from "next-auth";
import {
  deserializeSession,
  serializeSession,
} from "../sessionHeader";

const session = {
  expires: "2030-01-01T00:00:00.000Z",
  accessToken: "token",
  refreshToken: "refresh-token",
  tenantId: "keep",
  userRole: "admin",
  user: {
    id: "user-id",
    name: "Test User",
    email: "test@example.com",
    accessToken: "token",
    tenantId: "keep",
    role: "admin",
  },
} satisfies Session;

describe("session header serialization", () => {
  it("round trips a session", () => {
    expect(deserializeSession(serializeSession(session))).toEqual(session);
  });

  it("supports unicode session values", () => {
    const unicodeSession = {
      ...session,
      user: { ...session.user, name: "בדיקה" },
    };

    expect(deserializeSession(serializeSession(unicodeSession))).toEqual(
      unicodeSession
    );
  });

  it.each([null, "", "not-json", "%E0%A4%A"])(
    "returns null for an absent or invalid value",
    (value) => {
      expect(deserializeSession(value)).toBeNull();
    }
  );
});
