/**
 * @jest-environment node
 */
// Tests for the `/api/metrics/*` ingestion + scrape routes:
// authentication (401 without session), server-side allow-list (400 on unknown
// label), happy-path increments, and scrape-token protection on GET.

import { auth } from "@/auth";
import { register } from "@/metrics/metrics";

jest.mock("@/auth", () => ({ auth: jest.fn() }));

const mockedAuth = auth as unknown as jest.Mock;

const FAKE_SESSION = {
  user: { email: "test@example.com" },
  accessToken: "test-token",
};

function jsonReq(body: unknown) {
  return { json: async () => body } as any;
}

function getReq(headers: Record<string, string> = {}) {
  return { headers: new Headers(headers) } as any;
}

// Read a counter's value for a given label set (0 if the series is absent).
async function counterValue(
  name: string,
  match: Record<string, string> = {}
): Promise<number> {
  const metric = register.getSingleMetric(name) as any;
  const data = await metric.get();
  const entry = data.values.find((v: any) =>
    Object.entries(match).every(([k, val]) => v.labels[k] === val)
  );
  return entry ? entry.value : 0;
}

beforeEach(() => {
  mockedAuth.mockReset();
});

describe("POST /api/metrics/page", () => {
  let POST: any;
  const ORIG_API_URL = process.env.API_URL;
  beforeAll(async () => {
    POST = (await import("@/app/api/metrics/page/route")).POST;
  });
  beforeEach(() => {
    process.env.API_URL = "http://gw:8080";
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true });
  });
  afterAll(() => {
    if (ORIG_API_URL === undefined) delete process.env.API_URL;
    else process.env.API_URL = ORIG_API_URL;
  });

  it("returns 401 without a session", async () => {
    mockedAuth.mockResolvedValue(null);
    const res = await POST(jsonReq({ label: "incidents" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an unknown page label (no forward)", async () => {
    mockedAuth.mockResolvedValue(FAKE_SESSION);
    const res = await POST(jsonReq({ label: "preset:secret-name" }));
    expect(res.status).toBe(400);
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it("forwards a valid page view to the gateway /ui/page-view", async () => {
    mockedAuth.mockResolvedValue(FAKE_SESSION);
    const res = await POST(jsonReq({ label: "incidents" }));
    expect(res.status).toBe(200);
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global as any).fetch.mock.calls[0];
    expect(url).toBe("http://gw:8080/ui/page-view");
    expect(JSON.parse(init.body)).toEqual({ route: "incidents" });
    expect(init.headers["X-Keep-Source"]).toBe("ui");
  });
});

describe("POST /api/metrics/action", () => {
  let POST: any;
  beforeAll(async () => {
    POST = (await import("@/app/api/metrics/action/route")).POST;
  });

  it("returns 401 without a session", async () => {
    mockedAuth.mockResolvedValue(null);
    const res = await POST(jsonReq({ label: "change_status", latency: 0.1 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an unknown action label", async () => {
    mockedAuth.mockResolvedValue(FAKE_SESSION);
    const res = await POST(jsonReq({ label: "create_preset", latency: 0.1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when latency is missing", async () => {
    mockedAuth.mockResolvedValue(FAKE_SESSION);
    const res = await POST(jsonReq({ label: "change_status" }));
    expect(res.status).toBe(400);
  });

  it("increments the counter for a valid action", async () => {
    mockedAuth.mockResolvedValue(FAKE_SESSION);
    const before = await counterValue("keep_ui_action_executions_total", {
      action: "change_status",
    });
    const res = await POST(jsonReq({ label: "change_status", latency: 0.1 }));
    expect(res.status).toBe(200);
    const after = await counterValue("keep_ui_action_executions_total", {
      action: "change_status",
    });
    expect(after).toBe(before + 1);
  });
});

describe("POST /api/metrics/errors", () => {
  let POST: any;
  beforeAll(async () => {
    POST = (await import("@/app/api/metrics/errors/route")).POST;
  });

  it("returns 401 without a session", async () => {
    mockedAuth.mockResolvedValue(null);
    const res = await POST(jsonReq({ action: "change_status" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an unknown action (dead label)", async () => {
    mockedAuth.mockResolvedValue(FAKE_SESSION);
    const res = await POST(jsonReq({ action: "timeline_loading" }));
    expect(res.status).toBe(400);
  });

  it("increments the counter for a valid action", async () => {
    mockedAuth.mockResolvedValue(FAKE_SESSION);
    const before = await counterValue("keep_ui_errors_total", {
      action: "add_note",
    });
    const res = await POST(jsonReq({ action: "add_note" }));
    expect(res.status).toBe(200);
    const after = await counterValue("keep_ui_errors_total", {
      action: "add_note",
    });
    expect(after).toBe(before + 1);
  });
});

describe("POST /api/metrics/global-errors", () => {
  let POST: any;
  beforeAll(async () => {
    POST = (await import("@/app/api/metrics/global-errors/route")).POST;
  });

  it("returns 401 without a session", async () => {
    mockedAuth.mockResolvedValue(null);
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(401);
  });

  it("increments the counter when authenticated", async () => {
    mockedAuth.mockResolvedValue(FAKE_SESSION);
    const before = await counterValue("keep_ui_global_errors_total");
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(200);
    const after = await counterValue("keep_ui_global_errors_total");
    expect(after).toBe(before + 1);
  });
});

describe("GET /api/metrics (scrape)", () => {
  let GET: any;
  const ORIGINAL = process.env.KEEP_METRICS_SCRAPE_TOKEN;
  beforeAll(async () => {
    GET = (await import("@/app/api/metrics/route")).GET;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.KEEP_METRICS_SCRAPE_TOKEN;
    else process.env.KEEP_METRICS_SCRAPE_TOKEN = ORIGINAL;
  });

  it("is open when no scrape token is configured", async () => {
    delete process.env.KEEP_METRICS_SCRAPE_TOKEN;
    const res = await GET(getReq());
    expect(res.status).toBe(200);
  });

  it("rejects a missing/wrong bearer token when configured", async () => {
    process.env.KEEP_METRICS_SCRAPE_TOKEN = "s3cret";
    expect((await GET(getReq())).status).toBe(401);
    expect(
      (await GET(getReq({ authorization: "Bearer wrong" }))).status
    ).toBe(401);
  });

  it("accepts the correct bearer token when configured", async () => {
    process.env.KEEP_METRICS_SCRAPE_TOKEN = "s3cret";
    const res = await GET(getReq({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
  });
});
