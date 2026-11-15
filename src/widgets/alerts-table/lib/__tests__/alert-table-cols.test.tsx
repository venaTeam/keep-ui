import React from "react";
import { render, renderHook, screen } from "@testing-library/react";
import { useAlertTableCols } from "../alert-table-utils";

jest.mock("@/utils/hooks/useConfig", () => ({
  useConfig: () => ({ data: { NOISY_ALERTS_ENABLED: true } }),
}));

jest.mock("@/utils/hooks/useProviders", () => ({
  useProviders: () => ({ data: undefined }),
}));

jest.mock("@/utils/hooks/useExpandedRows", () => ({
  useExpandedRows: () => ({ isRowExpanded: () => false }),
}));

jest.mock("@/features/alerts/alert-menu", () => ({
  AlertMenu: () => null,
}));

jest.mock("@/entities/alerts/ui", () => ({
  AlertName: () => null,
}));

jest.mock("@/widgets/alerts-table/ui/alert-assignee", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/widgets/alerts-table/ui/alert-extra-payload", () => ({
  __esModule: true,
  default: () => null,
}));

const ringingAlert = {
  fingerprint: "fp-1",
  severity: "critical",
  status: "firing",
  deleted: false,
};

function getColumns(presetNoisy: boolean) {
  const { result } = renderHook(() =>
    useAlertTableCols({ presetName: "cols-test", presetNoisy })
  );
  return result.current as any[];
}

function renderCell(column: any, alert: Record<string, unknown>) {
  return render(
    <>{column.cell({ row: { original: alert }, getValue: () => alert.status })}</>
  );
}

describe("useAlertTableCols severity, status and noise", () => {
  it("has no separate noise column, even with NOISY_ALERTS_ENABLED", () => {
    const columns = getColumns(true);
    expect(columns.find((column) => column.id === "noise")).toBeUndefined();
  });

  it("gives severity and status fixed sizes that match their CSS width", () => {
    const columns = getColumns(false);
    const severity = columns.find((column) => column.id === "severity");
    const status = columns.find((column) => column.id === "status");

    expect(severity).toMatchObject({
      size: 96,
      minSize: 96,
      maxSize: 96,
      header: "Severity",
      enableResizing: false,
    });
    expect(severity.meta.tdClassName).toContain("!w-[96px]");
    expect(status).toMatchObject({
      size: 160,
      minSize: 160,
      maxSize: 160,
      header: "Status",
      enableResizing: false,
    });
    expect(status.meta.tdClassName).toContain("!w-[160px]");
  });

  it("renders the severity word next to the row-edge strip", () => {
    const columns = getColumns(false);
    const severity = columns.find((column) => column.id === "severity");
    renderCell(severity, ringingAlert);

    expect(screen.getByTestId("alert-severity-badge")).toHaveTextContent(
      "Critical"
    );
    expect(screen.getByLabelText("critical")).toHaveClass("bg-red-500");
  });

  it("renders Noisy on a firing critical alert only in a noisy preset", () => {
    const noisyStatus = getColumns(true).find((column) => column.id === "status");
    const { unmount } = renderCell(noisyStatus, ringingAlert);
    expect(screen.getByTestId("alert-status-pill")).toHaveTextContent(
      "FiringNoisy"
    );
    unmount();

    const quietStatus = getColumns(false).find((column) => column.id === "status");
    renderCell(quietStatus, { ...ringingAlert, isNoisy: true });
    expect(screen.getByTestId("alert-status-pill")).toHaveTextContent("Firing");
    expect(screen.queryByTestId("alert-noisy-segment")).not.toBeInTheDocument();
  });
});
