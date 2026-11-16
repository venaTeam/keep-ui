import { AlertDto } from "@/entities/alerts/model/types";
import { Status as IncidentStatus } from "@/entities/incidents/model";
import { hasLiveIncident } from "../has-live-incident";

const alert = (fields: Record<string, unknown>) =>
  ({
    id: "a",
    fingerprint: "fp",
    name: "disk-full",
    status: "firing",
    lastReceived: "2026-11-16T10:00:00Z",
    source: ["prometheus"],
    ...fields,
  }) as unknown as AlertDto;

describe("hasLiveIncident", () => {
  it("is false with no incident_dto", () => expect(hasLiveIncident(alert({}))).toBe(false));
  it("is false with an empty list", () => expect(hasLiveIncident(alert({ incident_dto: [] }))).toBe(false));
  it("is true for a confirmed, open incident", () =>
    expect(hasLiveIncident(alert({ incident_dto: [{ id: "i1", is_candidate: false, status: IncidentStatus.Firing }] }))).toBe(true));
  it("ignores candidate incidents", () =>
    expect(hasLiveIncident(alert({ incident_dto: [{ id: "i1", is_candidate: true, status: IncidentStatus.Firing }] }))).toBe(false));
  it("ignores deleted incidents", () =>
    expect(hasLiveIncident(alert({ incident_dto: [{ id: "i1", is_candidate: false, status: IncidentStatus.Deleted }] }))).toBe(false));
  it("is true when any one link is live", () =>
    expect(hasLiveIncident(alert({ incident_dto: [
      { id: "i1", is_candidate: true, status: IncidentStatus.Firing },
      { id: "i2", is_candidate: false, status: IncidentStatus.Resolved },
    ] }))).toBe(true));
});
