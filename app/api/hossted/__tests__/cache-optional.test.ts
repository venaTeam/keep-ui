// The route uses only NextRequest.nextUrl/text and NextResponse.json, so this
// test fakes just those; the default jsdom test environment has no Request or
// Response classes.
jest.mock("next/server", () => {
  class FakeResponse {
    constructor(private body: unknown, public status: number) {}
    json = async () => this.body;
    static json(body: unknown, init?: { status?: number }) {
      return new FakeResponse(body, init?.status ?? 200);
    }
  }
  class FakeRequest {
    nextUrl: URL;
    constructor(url: string, private init?: { body?: string }) {
      this.nextUrl = new URL(url);
    }
    text = async () => this.init?.body ?? "";
  }
  return { NextRequest: FakeRequest, NextResponse: FakeResponse };
});

const redisGet = jest.fn();
const redisSet = jest.fn();
const connect = jest.fn(async () => undefined);
const createClient = jest.fn(() => ({
  isOpen: true,
  connect,
  get: redisGet,
  set: redisSet,
  on: jest.fn(),
}));
jest.mock("redis", () => ({ createClient: () => createClient() }));

import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const upstreamReply = { summary: "<p>s</p>", response: "<p>r</p>" };
const post = (id: string) =>
  new NextRequest(`http://x/api/hossted?id=${id}`, { body: JSON.stringify({ messageId: id }) });
const get = (id: string) => new NextRequest(`http://x/api/hossted?id=${id}`);

describe("Hossted cache is optional", () => {
  const env = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env, HOSSTED_UPSTREAM_URL: "http://upstream/x", HOSSTED_UPSTREAM_TOKEN: "tok" };
    delete process.env.HOSSTED_REDIS_URL;
    global.fetch = jest.fn(async () => ({ status: 200, json: async () => upstreamReply })) as never;
  });
  afterAll(() => {
    process.env = env;
  });

  describe("with no Redis configured", () => {
    it("answers 404 for a restore and never connects", async () => {
      const res = await GET(get("a"));
      expect(res.status).toBe(404);
      expect(createClient).not.toHaveBeenCalled();
    });

    it("returns Hossted's answer without connecting", async () => {
      const res = await POST(post("a"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(upstreamReply);
      expect(createClient).not.toHaveBeenCalled();
    });
  });

  describe("with HOSSTED_REDIS_URL set", () => {
    beforeEach(() => {
      process.env.HOSSTED_REDIS_URL = "redis://cache:6379";
    });

    it("caches an analysis and restores it", async () => {
      await POST(post("a"));
      expect(redisSet).toHaveBeenCalledWith(
        "hossted:response:a",
        JSON.stringify(upstreamReply),
        expect.objectContaining({ EX: expect.any(Number) }),
      );
      redisGet.mockResolvedValue(JSON.stringify(upstreamReply));
      const res = await GET(get("a"));
      expect(await res.json()).toEqual(upstreamReply);
    });
  });
});
