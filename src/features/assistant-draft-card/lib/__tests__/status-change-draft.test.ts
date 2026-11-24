import {
  ChangeAlertStatusPayload,
  DraftAlert,
  TARGET_STATUSES,
} from "@/entities/assistant";
import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";
import {
  countReplacedNotes,
  getConfirmLabel,
  groupByFromStatus,
  mayResolveIncident,
  parseStatusChangePayload,
} from "../status-change-draft";

type GoldenDraft = keyof typeof golden.drafts;

const payload = golden.drafts.pending
  .payload as unknown as ChangeAlertStatusPayload;
const alert = (overrides: Partial<DraftAlert> = {}): DraftAlert => ({
  ...payload.alerts[0],
  ...overrides,
});

describe("parseStatusChangePayload", () => {
  it.each(Object.keys(golden.drafts) as GoldenDraft[])("reads %s", (name) => {
    const draft = golden.drafts[name];
    expect(parseStatusChangePayload(draft)).toEqual(draft.payload);
  });

  it.each<[string, unknown]>([
    ["nothing", null],
    ["a newer version", { ...payload, version: 2 }],
    ["an unknown status", { ...payload, target_status: "deleted" }],
    ["no alerts", { ...payload, alerts: undefined }],
    ["an alert without a fingerprint", { ...payload, alerts: [{}] }],
    ["an alert that is null", { ...payload, alerts: [null] }],
    ["a note that is not text", { ...payload, note: { text: "hi" } }],
    ["no dispose flag", { ...payload, dispose_on_new_alert: undefined }],
    ["a skipped alert that is text", { ...payload, skipped: ["fp"] }],
    ["a list that is not one", { ...payload, not_found: "fp" }],
    ["a fingerprint that is not text", { ...payload, unresolvable: [1] }],
  ])("refuses %s", (_, value) => {
    const draft = {
      kind: "change_alert_status",
      payload: value as Record<string, unknown>,
    };
    expect(parseStatusChangePayload(draft)).toBeNull();
  });

  it("refuses another kind", () => {
    expect(
      parseStatusChangePayload({ ...golden.drafts.pending, kind: "other" })
    ).toBeNull();
  });
});

it("groups the alerts by the status they have now", () => {
  expect(groupByFromStatus(payload.alerts)).toEqual([
    { status: "firing", count: 2 },
    { status: null, count: 1 },
  ]);
  expect(groupByFromStatus([])).toEqual([]);
});

describe("countReplacedNotes", () => {
  it("counts the alerts that have a note", () => {
    expect(countReplacedNotes(payload)).toBe(1);
  });

  it.each([[null], [""]])("is 0 for the note %j", (note) => {
    expect(countReplacedNotes({ ...payload, note })).toBe(0);
  });
});

describe("mayResolveIncident", () => {
  it.each<[boolean | null, boolean]>([
    [true, true],
    [false, false],
    [null, false],
  ])("with has_incident %s is %s", (has_incident, expected) => {
    const alerts = [alert({ has_incident: null }), alert({ has_incident })];
    expect(mayResolveIncident({ target_status: "resolved", alerts })).toBe(
      expected
    );
  });

  it.each(TARGET_STATUSES.filter((status) => status !== "resolved"))(
    "is false for %s",
    (target_status) => {
      expect(mayResolveIncident({ target_status, alerts: [alert()] })).toBe(
        false
      );
    }
  );
});

describe("getConfirmLabel", () => {
  it.each([
    ["acknowledged", "Acknowledge 10 alerts", "Acknowledge 1 alert"],
    ["resolved", "Resolve 10 alerts", "Resolve 1 alert"],
    ["suppressed", "Suppress 10 alerts", "Suppress 1 alert"],
    ["firing", "Set 10 alerts to firing", "Set 1 alert to firing"],
  ] as const)("for %s", (target_status, many, one) => {
    const alerts = Array.from({ length: 10 }, () => alert());
    expect(getConfirmLabel({ target_status, alerts })).toBe(many);
    expect(getConfirmLabel({ target_status, alerts: [alert()] })).toBe(one);
  });
});
