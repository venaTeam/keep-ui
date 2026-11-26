import { ApiClient } from "@/shared/api/ApiClient";
import { KeepApiError, KeepApiReadOnlyError } from "@/shared/api/KeepApiError";
import { isValidAction } from "@/metrics/labels";

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

describe("ApiClient assistant routing", () => {
  const GATEWAY_URL = "http://gateway.internal:8080";
  const session = { accessToken: "real-token" } as any;
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  const jsonResponse = (status: number, body: unknown) => ({
    ok: status < 400,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  });

  const createClient = ({ server = false, config = {} } = {}) => {
    const client = new ApiClient(session, config as any);
    (client as any).isServer = server;
    return client;
  };

  const requestedUrl = () => fetchMock.mock.calls[0][0];

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { id: "c1" }));
    global.fetch = fetchMock;
    jest.replaceProperty(process, "env", {
      ...process.env,
      API_URL: GATEWAY_URL,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("goes through /backend on the client, even with an absolute API_URL_CLIENT", async () => {
    const client = createClient({
      config: { API_URL_CLIENT: "https://api.example.com" },
    });

    await client.get("/assistant/conversations/c1");

    expect(requestedUrl()).toBe("/backend/assistant/conversations/c1");
  });

  it.each(["production", "development"])(
    "goes straight to API_URL on a %s server, without any other setting",
    async (NODE_ENV) => {
      Object.assign(process.env, { NODE_ENV });

      await createClient({ server: true }).get("/assistant/conversations/c1");

      expect(requestedUrl()).toBe(`${GATEWAY_URL}/assistant/conversations/c1`);
    }
  );

  it.each([true, false])(
    "sends the session's token (server: %s)",
    async (server) => {
      await createClient({ server }).post("/assistant/drafts/d1/confirm");

      expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
        Authorization: "Bearer real-token",
      });
    }
  );

  it.each([
    [true, `${GATEWAY_URL}/assistantx`],
    [false, "https://api.example.com/assistantx"],
  ])("does not catch /assistantx (server: %s)", async (server, expected) => {
    const client = createClient({
      server,
      config: { API_URL_CLIENT: "https://api.example.com" },
    });

    await client.get("/assistantx");

    expect(requestedUrl()).toBe(expected);
  });

  describe("in read-only mode", () => {
    const config = { READ_ONLY: true };

    it("allows assistant posts", async () => {
      await createClient({ config }).post("/assistant/drafts/d1/discard");

      expect(requestedUrl()).toBe("/backend/assistant/drafts/d1/discard");
    });

    it.each(["/assistantx/y", "/alerts/batch_enrich"])(
      "still blocks a post to %s",
      async (url) => {
        await expect(
          createClient({ config }).post(url, {})
        ).rejects.toBeInstanceOf(KeepApiReadOnlyError);
        expect(fetchMock).not.toHaveBeenCalled();
      }
    );
  });

  it.each([
    [400, "validation_error"],
    [403, "forbidden"],
    [403, "identity_unavailable"],
    [404, "draft_not_found"],
    [409, "draft_not_pending"],
    [502, "gateway_unavailable"],
    [503, "llm_not_configured"],
  ])(
    "raises a readable KeepApiError for a %s %s body",
    async (status, code) => {
      const body = {
        errors: [{ field: null, code, message: "Something went wrong" }],
        detail: "Something went wrong",
      };
      fetchMock.mockResolvedValue(jsonResponse(status, body));

      const error = await createClient()
        .post("/assistant/drafts/d1/confirm")
        .catch((e) => e);

      expect(error).toBeInstanceOf(KeepApiError);
      expect(error.message).toContain("Something went wrong");
      expect(error.statusCode).toBe(status);
      expect(error.responseJson.errors[0].code).toBe(code);
    }
  );
});

describe("assistant metric labels", () => {
  it.each([
    "assistant_message",
    "assistant_confirm",
    "assistant_stream_timeout",
    "assistant_stream_truncated",
  ])("declares %s", (label) => {
    expect(isValidAction(label)).toBe(true);
  });
});
