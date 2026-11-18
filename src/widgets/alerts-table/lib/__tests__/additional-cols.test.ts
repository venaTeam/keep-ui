import { AlertDto } from "@/entities/alerts/model/types";
import { getAdditionalColsToGenerate } from "@/widgets/alerts-table/lib/additional-cols";

const alertWith = (fields: Record<string, unknown>) =>
  ({
    id: "a",
    name: "disk-full",
    status: "firing",
    lastReceived: "2026-10-01T10:00:00Z",
    source: ["prometheus"],
    ...fields,
  }) as unknown as AlertDto;

describe("getAdditionalColsToGenerate", () => {
  it("returns the sorted, unique field keys the table has no fixed column for", () => {
    expect(
      getAdditionalColsToGenerate([
        alertWith({ service: "checkout", region: "eu" }),
        alertWith({ service: "payments", fingerprint: "fp" }),
      ])
    ).toEqual(["fingerprint", "region", "service"]);
  });

  it("expands object fields into dotted sub-keys", () => {
    expect(
      getAdditionalColsToGenerate([
        alertWith({ labels: { team: "core", zone: "a" } }),
        alertWith({ labels: { team: "edge" }, ticket_id: null }),
      ])
    ).toEqual(["labels.team", "labels.zone", "ticket_id"]);
  });

  it("returns nothing for no alerts", () => {
    expect(getAdditionalColsToGenerate([])).toEqual([]);
  });

  const alertWithLists = alertWith({
    incident_dto: [{ id: "i1", user_generated_name: "Checkout degraded" }],
    enriched_fields: ["service"],
    labels: { team: "core" },
  });

  it("by default expands a list field into one key per item, as the presets page always has", () => {
    expect(getAdditionalColsToGenerate([alertWithLists])).toEqual([
      "enriched_fields.0",
      "incident_dto.0",
      "labels.team",
    ]);
  });

  it("with arraysAsLeaves keeps a list field as one key and still expands objects", () => {
    expect(
      getAdditionalColsToGenerate([alertWithLists], { arraysAsLeaves: true })
    ).toEqual(["enriched_fields", "incident_dto", "labels.team"]);
  });

  it("with arraysAsLeaves keeps an empty list field as one key", () => {
    expect(
      getAdditionalColsToGenerate([alertWith({ enriched_fields: [] })], {
        arraysAsLeaves: true,
      })
    ).toEqual(["enriched_fields"]);
  });
});
