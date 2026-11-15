import React from "react";
import { render, screen } from "@testing-library/react";
import WidgetAlertsTable from "../widget-alerts-table";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("WidgetAlertsTable", () => {
  it("shows the payload value for a snake_case column named by the facet fields list", () => {
    const alerts = [
      { name: "disk-full", lastReceived: "2026-10-01T10:00:00Z" },
    ];

    render(
      <WidgetAlertsTable
        presetName="feed"
        alerts={alerts}
        columns={["name", "last_received"]}
      />
    );

    expect(screen.getByText("2026-10-01T10:00:00Z")).toBeInTheDocument();
  });

  it("renders severity and status as words with headers", () => {
    const alerts = [
      { severity: "critical", status: "firing", name: "a" },
      { severity: 5, status: "resolved", name: "b" },
    ];

    render(
      <WidgetAlertsTable
        presetName="feed"
        alerts={alerts}
        columns={["severity", "status", "name"]}
      />
    );

    expect(screen.getByText("Severity")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getAllByText("Critical")).toHaveLength(2);
    expect(screen.getByText("Firing")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  it("shows Noisy only on firing critical rows of a noisy preset", () => {
    const alerts = [
      { severity: "critical", status: "firing", name: "rings" },
      { severity: "high", status: "firing", name: "flagged", isNoisy: true },
      { severity: "critical", status: "acknowledged", name: "acked" },
    ];
    const columns = ["severity", "status", "name"];

    const { rerender } = render(
      <WidgetAlertsTable
        presetName="feed"
        alerts={alerts}
        columns={columns}
        presetNoisy
      />
    );
    expect(screen.getAllByTestId("alert-noisy-segment")).toHaveLength(1);

    rerender(
      <WidgetAlertsTable presetName="feed" alerts={alerts} columns={columns} />
    );
    expect(screen.queryByTestId("alert-noisy-segment")).not.toBeInTheDocument();
  });
});
