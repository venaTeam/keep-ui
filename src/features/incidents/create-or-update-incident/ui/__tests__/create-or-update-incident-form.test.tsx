import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreateOrUpdateIncidentForm } from "../create-or-update-incident-form";
import type { IncidentDto } from "@/entities/incidents/model";

const mockAddIncident = jest.fn();
const mockUpdateIncident = jest.fn();

jest.mock("@/entities/incidents/model", () => ({
  useIncidentActions: () => ({
    addIncident: mockAddIncident,
    updateIncident: mockUpdateIncident,
  }),
}));
// A signed-in user with an email: the form must not hand it to the incident.
jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { email: "signed-in@keep.dev", name: "Signed In" } },
    status: "authenticated",
  }),
}));
jest.mock("next/dynamic", () => () => () => null);
jest.mock("@/features/incidents/change-incident-severity", () => ({
  IncidentSeveritySelect: () => null,
}));
jest.mock("@/utils/metrics", () => ({
  recordAction: jest.fn(),
  recordError: jest.fn(),
}));

function assigneeInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector(
    '[data-cy="incidents-form-assignee-input"] input, input[data-cy="incidents-form-assignee-input"]'
  ) as HTMLInputElement;
}

describe("CreateOrUpdateIncidentForm", () => {
  beforeEach(() => {
    mockAddIncident.mockReset().mockResolvedValue({ id: "new-incident" });
    mockUpdateIncident.mockReset();
  });

  it("leaves the assignee empty for a new incident", () => {
    const { container } = render(
      <CreateOrUpdateIncidentForm incidentToEdit={null} />
    );

    expect(assigneeInput(container).value).toBe("");
  });

  it("creates the incident with no assignee unless one is typed", async () => {
    const createCallback = jest.fn();
    const { container } = render(
      <CreateOrUpdateIncidentForm
        incidentToEdit={null}
        createCallback={createCallback}
      />
    );

    fireEvent.change(
      container.querySelector(
        '[data-cy="incidents-form-name-input"] input, input[data-cy="incidents-form-name-input"]'
      ) as HTMLInputElement,
      { target: { value: "Unowned incident" } }
    );
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(createCallback).toHaveBeenCalledWith("new-incident"));
    expect(mockAddIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        user_generated_name: "Unowned incident",
        assignee: "",
      })
    );
  });

  it("still shows an existing incident's assignee when editing", () => {
    const { container } = render(
      <CreateOrUpdateIncidentForm
        incidentToEdit={
          {
            id: "existing",
            user_generated_name: "Owned incident",
            assignee: "owner@keep.dev",
          } as IncidentDto
        }
      />
    );

    expect(assigneeInput(container).value).toBe("owner@keep.dev");
  });
});
