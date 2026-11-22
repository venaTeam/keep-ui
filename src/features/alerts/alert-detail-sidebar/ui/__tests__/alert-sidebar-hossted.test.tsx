import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useConfig } from "@/utils/hooks/useConfig";
import { AlertDto } from "@/entities/alerts/model";
import { AlertSidebarHossted } from "../alert-sidebar-hossted";

jest.mock("@hossted/keep-integration", () => ({
  HosstedSidebarSection: () => <div data-testid="hossted-sidebar-section" />,
}));

const mockedUseConfig = useConfig as jest.Mock;
const alert = { fingerprint: "fp-1" } as unknown as AlertDto;

describe("AlertSidebarHossted", () => {
  afterEach(() => {
    mockedUseConfig.mockReturnValue({ data: {} });
  });

  it("renders the Hossted header and section when enabled", () => {
    mockedUseConfig.mockReturnValue({ data: { HOSSTED_ENABLED: true } });
    render(<AlertSidebarHossted alert={alert} />);
    expect(screen.getByText("Hossted")).toBeInTheDocument();
    expect(screen.getByTestId("hossted-sidebar-section")).toBeInTheDocument();
  });

  it("renders nothing when disabled", () => {
    mockedUseConfig.mockReturnValue({ data: { HOSSTED_ENABLED: false } });
    const { container } = render(<AlertSidebarHossted alert={alert} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the flag is absent", () => {
    mockedUseConfig.mockReturnValue({ data: {} });
    const { container } = render(<AlertSidebarHossted alert={alert} />);
    expect(container).toBeEmptyDOMElement();
  });
});
