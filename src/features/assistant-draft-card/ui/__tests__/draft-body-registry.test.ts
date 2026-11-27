import { CHANGE_ALERT_STATUS_KIND, DraftView } from "@/entities/assistant";
import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";
import { NO_CONFIRM_INPUT } from "../../lib/draft-presenter";
import {
  DRAFT_TOOL_NAMES,
  getRefreshKeys,
  presentDraft,
} from "../draft-body-registry";

const draft = (name: keyof typeof golden.drafts, changes: object = {}) =>
  ({ ...golden.drafts[name], ...changes }) as unknown as DraftView;

const ALERT_QUERY_KEYS = [
  { key: "/alerts/query", isExact: false },
  { key: "/preset", isExact: false },
];

it("names the tools that make a draft", () => {
  expect(DRAFT_TOOL_NAMES).toContain(CHANGE_ALERT_STATUS_KIND);
});

describe("a status change", () => {
  it("is shown by its kind, with Confirm and no body to send", () => {
    const presentation = presentDraft(draft("pending"));
    expect(presentation.confirmLabel).toMatch(/^Acknowledge \d+ alerts?$/);
    expect(presentation.confirmInput).toEqual(NO_CONFIRM_INPUT);
    expect(presentation.openInForm).toBeNull();
    expect(presentation.followUp).toBeNull();
  });

  it.each(["applied", "partially_applied", "applied_unverified"] as const)(
    "refreshes the alerts and preset counters by prefix when %s",
    (name) => {
      expect(getRefreshKeys(draft(name))).toEqual(ALERT_QUERY_KEYS);
    }
  );

  it.each([
    "pending",
    "applying",
    "applied_nothing_to_change",
    "failed",
    "failed_outcome_unknown",
    "discarded",
    "expired",
  ] as const)("refreshes nothing when %s", (name) => {
    expect(getRefreshKeys(draft(name))).toEqual([]);
  });
});

describe("a draft this build can't show in full", () => {
  it.each([
    ["of a kind it does not know", { kind: "save_dashboard" }],
    [
      "with a payload it can't read",
      { payload: { ...golden.drafts.pending.payload, alerts: "all" } },
    ],
  ])("%s is shown as it is, without Confirm or refresh", (_, changes) => {
    const presentation = presentDraft(draft("applied", changes));
    expect(presentation.confirmLabel).toBeNull();
    expect(presentation.refreshKeys).toEqual([]);
    expect(presentation.openInForm).toBeNull();
    expect(presentation.followUp).toBeNull();
  });
});
