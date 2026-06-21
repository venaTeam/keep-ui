import { ApiClient } from "@/shared/api/ApiClient";

describe("ApiClient headers", () => {
  it("tags authenticated requests with X-Keep-Source: ui (BI Phase 2)", () => {
    const session = {
      user: { email: "t@example.com" },
      accessToken: "real-token",
    } as any;
    const client = new ApiClient(session, {} as any);

    const headers = (client as any).getHeaders();

    expect(headers["X-Keep-Source"]).toBe("ui");
    expect(headers["Authorization"]).toBe("Bearer real-token");
  });

  it("does not add auth headers for a guest (unauthenticated) session", () => {
    const session = { accessToken: "unauthenticated" } as any;
    const client = new ApiClient(session, {} as any);

    const headers = (client as any).getHeaders();

    expect(headers["Authorization"]).toBeUndefined();
  });
});
