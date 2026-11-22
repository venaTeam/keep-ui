import React from "react";
import { act, render, renderHook } from "@testing-library/react";
import {
  RowStyleOverrideProvider,
  useAlertRowStyle,
} from "@/entities/alerts/model/useAlertRowStyle";
import { AlertName } from "@/entities/alerts/ui/AlertName/AlertName";
import { AlertDto } from "@/entities/alerts/model/types";

const STORAGE_KEY = "keephq-alert-table-row-style";

describe("useAlertRowStyle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the stored preference with no provider", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify("relaxed"));
    const { result } = renderHook(() => useAlertRowStyle());
    expect(result.current[0]).toBe("relaxed");
  });

  it("returns the override inside RowStyleOverrideProvider", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify("relaxed"));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RowStyleOverrideProvider value="default">{children}</RowStyleOverrideProvider>
    );
    const { result } = renderHook(() => useAlertRowStyle(), { wrapper });
    expect(result.current[0]).toBe("default");
  });

  it("a null override falls back to the stored preference", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify("relaxed"));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RowStyleOverrideProvider value={null}>{children}</RowStyleOverrideProvider>
    );
    const { result } = renderHook(() => useAlertRowStyle(), { wrapper });
    expect(result.current[0]).toBe("relaxed");
  });

  it("the setter still writes the stored preference inside the provider", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RowStyleOverrideProvider value="default">{children}</RowStyleOverrideProvider>
    );
    const { result } = renderHook(() => useAlertRowStyle(), { wrapper });
    act(() => {
      result.current[1]("relaxed");
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify("relaxed"));
    expect(result.current[0]).toBe("default");
  });

  it("is exported from the alerts model barrel", () => {
    const barrel = jest.requireActual("@/entities/alerts/model");
    expect(barrel.RowStyleOverrideProvider).toBeDefined();
    expect(barrel.RowStyleOverrideProvider).toBe(RowStyleOverrideProvider);
  });

  it("AlertName inside the provider renders at the overridden density", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify("relaxed"));
    const alert = { name: "Disk usage above threshold" } as AlertDto;
    const { getByText } = render(
      <RowStyleOverrideProvider value="default">
        <AlertName alert={alert} />
      </RowStyleOverrideProvider>
    );
    const nameElement = getByText("Disk usage above threshold");
    expect(nameElement).toHaveClass("truncate");
    expect(nameElement).not.toHaveClass("line-clamp-3");
  });

  it("AlertName outside the provider keeps the stored relaxed density", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify("relaxed"));
    const alert = { name: "Disk usage above threshold" } as AlertDto;
    const { getByText } = render(<AlertName alert={alert} />);
    const nameElement = getByText("Disk usage above threshold");
    expect(nameElement).toHaveClass("line-clamp-3");
    expect(nameElement).not.toHaveClass("truncate");
  });
});
