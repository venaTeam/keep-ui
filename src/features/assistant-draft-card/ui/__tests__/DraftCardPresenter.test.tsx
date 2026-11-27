import { act, fireEvent, render } from "@testing-library/react";
import { DraftView, useAssistantContextStore } from "@/entities/assistant";
import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";
import { useApi } from "@/shared/lib/hooks/useApi";
import { useConfig } from "@/utils/hooks/useConfig";
import {
  ALERT_RESULT_LABELS,
  DraftPresenter,
  presentWith,
} from "../../lib/draft-presenter";
import { DraftCard } from "../DraftCard";
import { presentDraft } from "../draft-body-registry";

// The card as a kind with a body, a block and a follow-up would make it
jest.mock("../draft-body-registry", () => ({
  ...jest.requireActual("../draft-body-registry"),
  presentDraft: jest.fn(),
}));
jest.mock("@/utils/metrics", () => ({
  recordAction: jest.fn(),
  recordError: jest.fn(),
}));

interface FakePayload {
  name: string;
}

const BODY = {
  derived: {
    cel_roundtrip: "severity == 'critical'",
    sql_query: { sql: "severity = :p0", params: { p0: "critical" } },
  },
};

const fake = (
  overrides: Partial<DraftPresenter<FakePayload>> = {}
): DraftPresenter<FakePayload> => ({
  kind: "change_alert_status",
  tool: "change_alert_status",
  parse: () => ({ name: "Night shift" }),
  Body: ({ payload }) => <p data-testid="body">{payload.name}</p>,
  confirmLabel: ({ name }) => `Save ${name}`,
  notPermittedText: "Not yours",
  refreshKeys: () => [],
  resultLabels: ALERT_RESULT_LABELS,
  ...overrides,
});

const post = jest.fn();
const draft = (name: keyof typeof golden.drafts) =>
  golden.drafts[name] as unknown as DraftView;
const byCy = (name: string) =>
  document.querySelector<HTMLElement>(`[data-cy="${name}"]`);

const show = (
  view: DraftView,
  overrides: Partial<DraftPresenter<FakePayload>> = {}
) => {
  (presentDraft as jest.Mock).mockImplementation((next: DraftView) =>
    presentWith(fake(overrides), next)
  );
  render(
    <DraftCard
      draft={view}
      onChange={jest.fn()}
      onUncertain={jest.fn().mockResolvedValue(undefined)}
      onCheckAgain={jest.fn()}
    />
  );
};

const click = (element: HTMLElement | null) =>
  act(async () => {
    fireEvent.click(element as HTMLElement);
  });

beforeEach(() => {
  jest.useFakeTimers({ now: Date.parse("2026-11-24T10:05:00+00:00") });
  jest.resetAllMocks();
  (useApi as jest.Mock).mockReturnValue({ post });
  (useConfig as jest.Mock).mockReturnValue({ data: {} });
  useAssistantContextStore.setState(
    useAssistantContextStore.getInitialState(),
    true
  );
});

afterEach(() => {
  jest.useRealTimers();
});

it("shows the kind's body and label", () => {
  show(draft("pending"));
  expect(document.querySelector('[data-testid="body"]')).toHaveTextContent(
    "Night shift"
  );
  expect(byCy("assistant-draft-confirm")).toHaveTextContent("Save Night shift");
});

it("sends what the kind derived with Confirm", async () => {
  post.mockReturnValue(new Promise(() => {}));
  show(draft("pending"), {
    confirmInput: () => ({ isBlocked: false, body: BODY }),
  });
  await click(byCy("assistant-draft-confirm"));
  expect(post).toHaveBeenCalledWith(
    `/assistant/drafts/${golden.drafts.pending.id}/confirm`,
    BODY
  );
});

it("disables Confirm with the kind's reason", async () => {
  show(draft("pending"), {
    confirmInput: () => ({ isBlocked: true, reason: "The filter changed." }),
  });
  expect(byCy("assistant-draft-confirm")).toBeDisabled();
  expect(byCy("assistant-draft-confirm-blocked")).toHaveTextContent(
    "The filter changed."
  );
  expect(byCy("assistant-draft-discard")).toBeEnabled();
  await click(byCy("assistant-draft-confirm"));
  expect(post).not.toHaveBeenCalled();
});

describe("a follow-up", () => {
  const followUp = () => ({
    text: "Which of them are still firing?",
    fingerprints: ["prod-db-01:cpu", "prod-db-02:disk"],
  });

  it("is offered on a final card, which has no other button", () => {
    show(draft("applied"), { followUp });
    expect(byCy("assistant-draft-confirm")).toBeNull();
    expect(byCy("assistant-draft-follow-up")).toHaveAttribute(
      "title",
      "Which of them are still firing?"
    );
  });

  it("pre-fills the composer and selects its alerts, as context", async () => {
    show(draft("applied"), { followUp });
    await click(byCy("assistant-draft-follow-up"));
    expect(useAssistantContextStore.getState()).toMatchObject({
      composerPrefill: "Which of them are still firing?",
      selection: [
        { fingerprint: "prod-db-01:cpu" },
        { fingerprint: "prod-db-02:disk" },
      ],
      selectionIncluded: true,
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("is not offered when the kind has none for this draft", () => {
    show(draft("failed"), { followUp: () => null });
    expect(byCy("assistant-draft-follow-up")).toBeNull();
  });
});
