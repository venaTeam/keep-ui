import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { ReactNode } from "react";
import { useConfig } from "@/utils/hooks/useConfig";
import { useApi } from "@/shared/lib/hooks/useApi";
import { KeepApiError } from "@/shared/api/KeepApiError";
import {
  useAutomationActions,
  useAutomationDetail,
  useAutomations,
} from "../hooks";
const record = {
  id: "one",
  name: "Test",
  namespace: "payments",
  script: "original script",
  matching_state: "inactive",
  build_state: "idle",
  active_digest: "sha256:1234",
};
let current: typeof record;
let failRefresh: boolean;
let cache: Map<string, any>;
let listCalls: string[];
let session = {
  tenantId: "tenant-a",
  user: { email: "alice@example.test" },
  userRole: "user",
};
jest.mock("@/shared/lib/hooks/useHydratedSession", () => ({
  useHydratedSession: () => ({ data: session, status: "authenticated" }),
}));
const api = {
  isReady: () => true,
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};
function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => cache,
        dedupingInterval: 0,
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}
beforeEach(() => {
  session = {
    tenantId: "tenant-a",
    user: { email: "alice@example.test" },
    userRole: "user",
  };
  current = { ...record };
  cache = new Map();
  listCalls = [];
  failRefresh = false;
  jest
    .mocked(useConfig)
    .mockReturnValue({ data: { KEEP_AUTOMATIONS_ENABLED: true } as any });
  jest.mocked(useApi).mockReturnValue(api as any);
  api.get.mockReset().mockImplementation(async (path: string) => {
    if (failRefresh) throw new Error("Network failure");
    if (path === "/automations/one") return { ...current };
    listCalls.push(path);
    return { automations: [{ ...current }] };
  });
  api.post.mockReset().mockImplementation(async () => {
    current.matching_state = "active";
    return { id: "one", matching_state: "active" };
  });
});
function useAll() {
  return {
    detail: useAutomationDetail("one"),
    all: useAutomations({}),
    filtered: useAutomations({ namespace: "payments" }),
    actions: useAutomationActions("one"),
  };
}
test("partial lifecycle responses preserve definition and refresh every list variant", async () => {
  const { result } = renderHook(useAll, { wrapper });
  await waitFor(() =>
    expect(result.current.detail.data?.script).toBe("original script")
  );
  listCalls = [];
  await act(async () => {
    await result.current.actions.run("enable");
  });
  expect(result.current.detail.data?.script).toBe("original script");
  expect(result.current.detail.data?.matching_state).toBe("active");
  expect(listCalls).toEqual(
    expect.arrayContaining(["/automations", "/automations?namespace=payments"])
  );
});
test("successful write plus failed refresh is not reported as a failed write and cannot be replayed", async () => {
  const { result } = renderHook(useAll, { wrapper });
  await waitFor(() => expect(result.current.detail.data).toBeDefined());
  failRefresh = true;
  await act(async () => {
    await result.current.actions.run("enable");
  });
  expect(result.current.actions.message).toMatch(
    /Action succeeded, but refreshing failed/
  );
  expect(result.current.detail.data?.script).toBe("original script");
  expect(result.current.actions.needsRefresh).toBe(true);
  await act(async () => {
    await result.current.actions.run("enable");
  });
  expect(api.post).toHaveBeenCalledTimes(1);
  failRefresh = false;
  await act(async () => {
    await result.current.actions.retryRefresh();
  });
  expect(result.current.actions.needsRefresh).toBe(false);
});
test.each([409, 503])(
  "%s refreshes before retry and never automatically repeats the mutation",
  async (status) => {
    const { result } = renderHook(useAll, { wrapper });
    await waitFor(() => expect(result.current.detail.data).toBeDefined());
    api.post.mockRejectedValueOnce(
      new KeepApiError("Failure", "", "", {}, status)
    );
    api.get.mockClear();
    await act(async () => {
      await result.current.actions.run("enable");
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith("/automations/one");
    expect(result.current.actions.pending).toBe(false);
  }
);
test("duplicate submissions are guarded synchronously", async () => {
  const { result } = renderHook(useAll, { wrapper });
  await waitFor(() => expect(result.current.detail.data).toBeDefined());
  await act(async () => {
    await Promise.all([
      result.current.actions.run("enable"),
      result.current.actions.run("enable"),
    ]);
  });
  expect(api.post).toHaveBeenCalledTimes(1);
});
test("feature off does not fetch", () => {
  jest
    .mocked(useConfig)
    .mockReturnValue({ data: { KEEP_AUTOMATIONS_ENABLED: false } as any });
  renderHook(useAll, { wrapper });
  expect(api.get).not.toHaveBeenCalled();
});
test("switching tenants never displays the previous tenant's cached record", async () => {
  const { result, rerender } = renderHook(useAll, { wrapper });
  await waitFor(() => expect(result.current.detail.data?.name).toBe("Test"));
  session = { ...session, tenantId: "tenant-b" };
  api.get.mockImplementation(() => new Promise(() => {}));
  rerender();
  expect(result.current.detail.data).toBeUndefined();
  expect(result.current.all.data).toBeUndefined();
});
test("ambiguous network outcome reads the applied state without replaying the write", async () => {
  const { result } = renderHook(useAll, { wrapper });
  await waitFor(() => expect(result.current.detail.data).toBeDefined());
  api.post.mockImplementationOnce(async () => {
    current.matching_state = "active";
    throw new TypeError("Connection lost after commit");
  });
  await act(async () => {
    await result.current.actions.run("enable");
  });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(result.current.detail.data?.matching_state).toBe("active");
  expect(result.current.actions.needsRefresh).toBe(false);
});
