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
jest.mock("@/components/ui/Modal", () => () => null);

describe("AlertAssociateIncidentModal", () => {
  beforeEach(() => {
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
});
