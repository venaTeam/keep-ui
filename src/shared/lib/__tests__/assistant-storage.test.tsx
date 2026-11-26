import { renderHook } from "@testing-library/react";
import { signOut } from "next-auth/react";
import { ApiClient } from "@/shared/api";
import {
  ASSISTANT_PANEL_STORAGE_KEY,
  clearAssistantStorage,
} from "../assistant-storage";
import { useSignOut } from "../hooks/useSignOut";

jest.mock("next-auth/react", () => ({ signOut: jest.fn() }));
jest.mock("@sentry/nextjs", () => ({ setUser: jest.fn() }));

const stored = () => localStorage.getItem(ASSISTANT_PANEL_STORAGE_KEY);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem(ASSISTANT_PANEL_STORAGE_KEY, "{}");
  localStorage.setItem("menu-minimized", "true");
});

it("forgets the panel and nothing else", () => {
  clearAssistantStorage();
  expect(stored()).toBeNull();
  expect(localStorage.getItem("menu-minimized")).toBe("true");
});

it("survives a browser without storage", () => {
  const removeItem = jest
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
  expect(clearAssistantStorage).not.toThrow();
  removeItem.mockRestore();
});

it("is cleared before a sign-out", () => {
  const storedAtSignOut: (string | null)[] = [];
  (signOut as jest.Mock).mockImplementation(() => {
    storedAtSignOut.push(stored());
  });
  renderHook(() => useSignOut()).result.current();
  expect(storedAtSignOut).toEqual([null]);
});

it("is cleared when an expired session is signed out", async () => {
  const client = new ApiClient({ accessToken: "x" } as never, {} as never);
  const response = {
    ok: false,
    status: 401,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ detail: "expired" }),
  } as Response;
  await expect(client.handleResponse(response, "/alerts")).rejects.toThrow(
    "expired"
  );
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(stored()).toBeNull();
});
