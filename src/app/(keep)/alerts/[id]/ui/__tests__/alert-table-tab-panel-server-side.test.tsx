import React from "react";
import { render } from "@testing-library/react";
import AlertTableTabPanelServerSide from "../alert-table-tab-panel-server-side";
import { Preset } from "@/entities/presets/model/types";

let mockTableProps: Record<string, unknown> = {};

jest.mock("@/widgets/alerts-table/ui/alert-table-server-side", () => ({
  AlertTableServerSide: (props: Record<string, unknown>) => {
    mockTableProps = props;
    return null;
  },
}));

jest.mock("@/widgets/alerts-table/lib/alert-table-utils", () => ({
  useAlertTableCols: () => [],
}));

jest.mock("@/entities/alerts/model", () => ({
  AlertKnownKeys: [],
  getTabsFromPreset: () => [],
}));

const renderPanel = (preset: Partial<Preset>) =>
  render(
    <AlertTableTabPanelServerSide
      alerts={[]}
      alertsTotalCount={0}
      facetsCel={null}
      facetsPanelRefreshToken={undefined}
      preset={{ id: "p1", name: "noisy", ...preset } as Preset}
      isAsyncLoading={false}
      setTicketModalAlert={jest.fn()}
      setNoteModalAlert={jest.fn()}
      setRunWorkflowModalAlert={jest.fn()}
      setDismissModalAlert={jest.fn()}
      setChangeStatusAlert={jest.fn()}
      setAssignModalAlert={jest.fn()}
      mutateAlerts={jest.fn()}
    />
  );

beforeEach(() => {
  mockTableProps = {};
});

describe("AlertTableTabPanelServerSide", () => {
  it("tells the table its preset is noisy", () => {
    renderPanel({ is_noisy: true });
    expect(mockTableProps.presetNoisy).toBe(true);
  });

  it("tells the table a quiet preset is not noisy", () => {
    renderPanel({ is_noisy: false });
    expect(mockTableProps.presetNoisy).toBe(false);
  });
});
