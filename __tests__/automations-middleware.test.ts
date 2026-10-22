/** @jest-environment node */
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
jest.mock("@/auth.config", () => ({ config: {} }));
jest.mock("next-auth", () => ({
  __esModule: true,
  default: () => ({ auth: (handler: unknown) => handler }),
}));
const invoke = middleware as unknown as (
  request: NextRequest & { auth: unknown }
) => Promise<Response>;
function request(path: string, method = "GET", authenticated = true) {
  return Object.assign(
    new NextRequest(`http://localhost${path}`, {
      method,
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      ...(method === "POST" ? { body: '{"example":true}' } : {}),
    }),
    {
      auth: authenticated
        ? { userRole: "user", user: {}, accessToken: "token" }
        : null,
    }
  );
}
beforeEach(() => {
  process.env.KEEP_AUTOMATIONS_ENABLED = "true";
  process.env.AUTOMATIONS_API_URL = "http://automation:8085";
  process.env.KEEP_READ_ONLY = "false";
});
test("proxy preserves query, authorization, method and body", async () => {
  const req = request("/backend/automations/abc/enable?revision=2", "POST");
  const response = await invoke(req);
  expect(response.headers.get("x-middleware-rewrite")).toBe(
    "http://automation:8085/automations/abc/enable?revision=2"
  );
  expect(response.headers.get("x-middleware-request-authorization")).toBe(
    "Bearer token"
  );
  expect(req.method).toBe("POST");
  expect(await req.text()).toBe('{"example":true}');
});
test("namespace alias rewrites only the exact endpoint", async () => {
  expect(
    (await invoke(request("/backend/automation-namespaces"))).headers.get(
      "x-middleware-rewrite"
    )
  ).toBe("http://automation:8085/namespaces");
});
test("feature-off, unauthenticated, read-only, and missing configuration fail explicitly", async () => {
  process.env.KEEP_AUTOMATIONS_ENABLED = "false";
  expect((await invoke(request("/backend/automations"))).status).toBe(404);
  process.env.KEEP_AUTOMATIONS_ENABLED = "true";
  expect(
    (await invoke(request("/backend/automations", "GET", false))).status
  ).toBe(401);
  process.env.KEEP_READ_ONLY = "true";
  expect(
    (await invoke(request("/backend/automations/id/enable", "POST"))).status
  ).toBe(403);
  delete process.env.AUTOMATIONS_API_URL;
  expect((await invoke(request("/backend/automations"))).status).toBe(503);
});
test("workflows and gateway routes keep existing routing", async () => {
  process.env.WORKFLOWS_API_URL = "http://workflows:8081";
  process.env.API_URL = "http://gateway:8080";
  expect(
    (await invoke(request("/backend/workflows?limit=5"))).headers.get(
      "x-middleware-rewrite"
    )
  ).toBe("http://workflows:8081/workflows?limit=5");
  expect(
    (await invoke(request("/backend/alerts"))).headers.get(
      "x-middleware-rewrite"
    )
  ).toBe("http://gateway:8080/alerts");
});
