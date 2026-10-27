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
});
