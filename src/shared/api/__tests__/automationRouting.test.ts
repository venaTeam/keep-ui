import { ApiClient } from "../ApiClient";
import { automationUpstreamPath } from "../automationRouting";
const fetchMock = jest.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock
    .mockReset()
    .mockResolvedValue({
      ok: true,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({}),
    });
});
test.each([
  "/automations?namespace=payments",
  "/automations/id",
  "/automations/id/enable",
  "/automation-namespaces",
])(
  "browser request %s uses BFF even with an absolute gateway",
  async (path) => {
    const api = new ApiClient(
      { accessToken: "token" } as any,
      { API_URL_CLIENT: "https://gateway.example.test" } as any
    );
    await api.post(path, { value: "test" });
    expect(fetchMock).toHaveBeenCalledWith(
      `/backend${path}`,
      expect.objectContaining({
        method: "POST",
        body: '{"value":"test"}',
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      })
    );
  }
);
test("other paths retain gateway routing", async () => {
  const api = new ApiClient(
    { accessToken: "token" } as any,
    { API_URL_CLIENT: "https://gateway.example.test" } as any
  );
  await api.get("/alerts?status=firing");
  expect(fetchMock).toHaveBeenCalledWith(
    "https://gateway.example.test/alerts?status=firing",
    expect.anything()
  );
});
test("automation proxy does not expose unrelated service endpoints", () => {
  expect(automationUpstreamPath("/automation-namespaces")).toBe("/namespaces");
  for (const path of [
    "/namespaces",
    "/internal/submit",
    "/events",
    "/automations/id/build",
    "/automations-extra",
    "/automation-namespaces/extra",
  ])
    expect(automationUpstreamPath(path)).toBeNull();
});
