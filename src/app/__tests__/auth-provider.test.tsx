import { render, screen } from "@testing-library/react";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { NextAuthProvider } from "../auth-provider";

jest.mock("next-auth/react", () => ({
  SessionProvider: jest.fn(
    ({ children }: { children: React.ReactNode }) => children
  ),
}));

const mockedSessionProvider = jest.mocked(SessionProvider);

describe("NextAuthProvider", () => {
  it("hydrates SessionProvider without automatic refetches", () => {
    const session = {
      expires: "2030-01-01T00:00:00.000Z",
      accessToken: "token",
      refreshToken: "refresh-token",
      user: {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        accessToken: "token",
      },
    } satisfies Session;

    render(
      <NextAuthProvider session={session}>
        <div>content</div>
      </NextAuthProvider>
    );

    expect(screen.getByText("content")).toBeInTheDocument();
    expect(mockedSessionProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        session,
        refetchInterval: 0,
        refetchOnWindowFocus: false,
      }),
      undefined
    );
  });
});
