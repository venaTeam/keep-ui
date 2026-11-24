import { format } from "date-fns";
import { IncidentDto, Status } from "@/entities/incidents/model";
import { getIncidentStatusLabel } from "../utils";

function incident(overrides: Partial<IncidentDto>): IncidentDto {
  return { id: "1", status: Status.Firing, ...overrides } as IncidentDto;
}

describe("getIncidentStatusLabel", () => {
  it("names the status of an incident that isn't suppressed", () => {
    expect(getIncidentStatusLabel(incident({}))).toBe("firing");
    expect(
      getIncidentStatusLabel(incident({ status: Status.Acknowledged }))
    ).toBe("acknowledged");
  });

  it("says suppressed for a permanent dismissal", () => {
    expect(
      getIncidentStatusLabel(
        incident({ status: Status.Suppressed, dismiss_mode: "permanent" })
      )
    ).toBe("suppressed");
  });

  it("names the deadline of a time-boxed dismissal, read as UTC", () => {
    const label = getIncidentStatusLabel(
      incident({
        status: Status.Suppressed,
        dismiss_mode: "dismiss_until",
        dismissed_until: "2026-11-19T12:30:00",
      })
    );
    expect(label).toBe(
      `suppressed until ${format(
        Date.parse("2026-11-19T12:30:00Z"),
        "MMM d, yyyy HH:mm"
      )}`
    );
  });

  it("falls back to suppressed when the deadline can't be read", () => {
    expect(
      getIncidentStatusLabel(
        incident({
          status: Status.Suppressed,
          dismiss_mode: "dismiss_until",
          dismissed_until: "not a date",
        })
      )
    ).toBe("suppressed");
  });

  it("is null for an incident with no status", () => {
    expect(
      getIncidentStatusLabel(incident({ status: undefined as any }))
    ).toBeNull();
  });
});
