import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useDashboardImage } from "../model/useDashboardImages";

jest.mock("@/shared/lib/hooks/useApi", () => ({
  useApi: () => ({
    isReady: () => true,
    getApiBaseUrl: () => "http://gateway",
    getHeaders: () => ({ Authorization: "Bearer t" }),
  }),
}));

const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';

function wrapper({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}

let createObjectURL: jest.Mock;

beforeEach(() => {
  createObjectURL = jest.fn(() => "blob:should-not-be-used");
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: jest.fn(), configurable: true });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    blob: async () => new Blob([svg], { type: "image/svg+xml" }),
  }) as unknown as typeof fetch;
});

describe("useDashboardImage", () => {
  it("returns a data URL for an uploaded SVG and never creates a blob URL", async () => {
    const { result } = renderHook(() => useDashboardImage("img-1"), { wrapper });
    await waitFor(() => expect(result.current.url).toBeDefined());
    expect(result.current.url).toMatch(/^data:image\/svg\+xml/);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      "http://gateway/dashboard-images/img-1",
      expect.anything()
    );
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("is loading and has no url before the image resolves", async () => {
    const { result } = renderHook(() => useDashboardImage("img-1"), { wrapper });
    expect(result.current.url).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("does nothing without an image id", () => {
    const { result } = renderHook(() => useDashboardImage(undefined), { wrapper });
    expect(result.current).toEqual({ url: undefined, error: undefined, isLoading: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
