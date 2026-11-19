import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { HosstedRoot } from "../hossted-root";

jest.mock("@hossted/keep-integration", () => ({
  HosstedConfigProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="hossted-config-provider">{children}</div>
  ),
  HosstedWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="hossted-wrapper">{children}</div>
  ),
}));

describe("HosstedRoot", () => {
  it("mounts the Hossted provider and wrapper when enabled", () => {
    render(
      <HosstedRoot enabled config={{}}>
        <p>app</p>
      </HosstedRoot>
    );
    expect(screen.getByTestId("hossted-config-provider")).toBeInTheDocument();
    expect(screen.getByTestId("hossted-wrapper")).toBeInTheDocument();
    expect(screen.getByText("app")).toBeInTheDocument();
  });

  it("renders only the children when disabled", () => {
    render(
      <HosstedRoot enabled={false} config={{}}>
        <p>app</p>
      </HosstedRoot>
    );
    expect(screen.queryByTestId("hossted-config-provider")).toBeNull();
    expect(screen.queryByTestId("hossted-wrapper")).toBeNull();
    expect(screen.getByText("app")).toBeInTheDocument();
  });
});
