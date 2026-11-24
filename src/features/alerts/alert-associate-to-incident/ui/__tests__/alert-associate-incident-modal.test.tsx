import React from "react";
import { render } from "@testing-library/react";
import { AlertAssociateIncidentModal } from "../alert-associate-incident-modal";
import { useIncidents } from "@/utils/hooks/useIncidents";
import { AlertDto } from "@/entities/alerts/model";

jest.mock("@/utils/hooks/useIncidents", () => ({
  useIncidents: jest.fn(),
  usePollIncidents: jest.fn(),
}));
jest.mock("@/shared/lib/hooks/useApi", () => ({
  useApi: () => ({ post: jest.fn() }),
}));
jest.mock("features/incidents/create-or-update-incident", () => ({
  CreateOrUpdateIncidentForm: () => null,
}));
jest.mock("@/app/(keep)/loading", () => () => null);
jest.mock("@/components/ui/Modal", () =>
  function MockModal({ children }: any) {
    return <>{children}</>;
  }
);
const mockSelect = jest.fn();
jest.mock("@/shared/ui", () => ({
  Select: (props: any) => {
    mockSelect(props);
    return null;
  },
  showErrorToast: jest.fn(),
}));

describe("AlertAssociateIncidentModal", () => {
  beforeEach(() => {
    mockSelect.mockClear();
    (useIncidents as jest.Mock).mockReturnValue({
      data: { items: [], count: 0 },
      isLoading: false,
      mutate: jest.fn(),
    });
  });

  it("offers suppressed incidents alongside firing and acknowledged", () => {
    render(
      <AlertAssociateIncidentModal
        isOpen
        handleSuccess={jest.fn()}
        handleClose={jest.fn()}
        alerts={[{ fingerprint: "fp-1" } as AlertDto]}
      />
    );

    const query = (useIncidents as jest.Mock).mock.calls[0][0];
    expect(query.cel).toBe(
      "status in ['firing', 'acknowledged', 'suppressed']"
    );
    expect(query.candidate).toBe(false);
  });

  it("names every incident's status in the options", () => {
    (useIncidents as jest.Mock).mockReturnValue({
      data: {
        items: [
          {
            id: "active",
            status: "firing",
            user_generated_name: "Active one",
            creation_time: "t1",
          },
          {
            id: "claimed",
            status: "acknowledged",
            user_generated_name: "Claimed one",
            creation_time: "t3",
          },
          {
            id: "dismissed",
            status: "suppressed",
            dismiss_mode: "permanent",
            user_generated_name: "Dismissed one",
            creation_time: "t2",
          },
        ],
        count: 3,
      },
      isLoading: false,
      mutate: jest.fn(),
    });

    render(
      <AlertAssociateIncidentModal
        isOpen
        handleSuccess={jest.fn()}
        handleClose={jest.fn()}
        alerts={[{ fingerprint: "fp-1" } as AlertDto]}
      />
    );

    const { options } = mockSelect.mock.calls[mockSelect.mock.calls.length - 1][0];
    expect(options).toEqual([
      { value: "active", label: "Active one (t1) — firing" },
      { value: "claimed", label: "Claimed one (t3) — acknowledged" },
      { value: "dismissed", label: "Dismissed one (t2) — suppressed" },
    ]);
  });
});
