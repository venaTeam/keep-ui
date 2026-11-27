import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ChangeAlertStatusPayload, DraftView } from "@/entities/assistant";
import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";
import { KeepApiError } from "@/shared/api";
import { useApi } from "@/shared/lib/hooks/useApi";
import { useConfig } from "@/utils/hooks/useConfig";
import { DraftCard, DraftCardProps } from "../DraftCard";

jest.mock("@/utils/metrics", () => ({
  recordAction: jest.fn(),
  recordError: jest.fn(),
}));

type GoldenDraft = keyof typeof golden.drafts;

const post = jest.fn();
const onChange = jest.fn();
const onUncertain = jest.fn();
const onCheckAgain = jest.fn();

const draft = (name: GoldenDraft, payload: object = {}): DraftView => {
  const view = golden.drafts[name] as unknown as DraftView;
  return { ...view, payload: { ...view.payload, ...payload } };
};
const alerts = (golden.drafts.pending.payload as ChangeAlertStatusPayload)
  .alerts;

const byCy = (name: string) =>
  document.querySelector<HTMLElement>(`[data-cy="${name}"]`);
const card = () => byCy("assistant-draft-card") as HTMLElement;
const confirmButton = () => byCy("assistant-draft-confirm");
const discardButton = () => byCy("assistant-draft-discard");
const outcome = () => byCy("assistant-draft-outcome");

const show = (view: DraftView | null, props: Partial<DraftCardProps> = {}) => {
  const element = (next: DraftView | null) => (
    <DraftCard
      draft={next}
      onChange={onChange}
      onUncertain={onUncertain}
      onCheckAgain={onCheckAgain}
      {...props}
    />
  );
  const { rerender } = render(element(view));
  return { update: (next: DraftView) => rerender(element(next)) };
};

const click = (element: HTMLElement | null) =>
  act(async () => {
    fireEvent.click(element as HTMLElement);
  });

beforeEach(() => {
  jest.useFakeTimers({ now: Date.parse("2026-11-24T10:05:00+00:00") });
  jest.resetAllMocks();
  onUncertain.mockResolvedValue(undefined);
  (useApi as jest.Mock).mockReturnValue({ post });
  (useConfig as jest.Mock).mockReturnValue({ data: {} });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("each state", () => {
  // [draft, data-state, outcome text, Confirm shown, Discard shown]
  it.each<[GoldenDraft, string, string | null, boolean, boolean]>([
    ["pending", "draft", null, true, true],
    [
      "pending_not_permitted",
      "not-permitted",
      "You don't have permission to change alert status",
      false,
      true,
    ],
    ["applying", "submitting", "Applying the change…", true, true],
    [
      "applying_outcome_pending",
      "submitting",
      "Keep is still applying this change.",
      true,
      true,
    ],
    ["applied", "saved", "All alerts were changed.", false, false],
    [
      "applied_nothing_to_change",
      "saved",
      "Every alert already had this status.",
      false,
      false,
    ],
    [
      "applied_unverified",
      "saved",
      "Keep accepted the change, but it could not be checked.",
      false,
      false,
    ],
    ["partially_applied", "partial", "Some alerts were changed.", false, false],
    ["failed", "error", "No alert was changed.", false, false],
    ["failed_rejected", "error", "Keep refused the change.", false, false],
    [
      "failed_rejected_maybe_written",
      "error",
      "No alert was changed.",
      false,
      false,
    ],
    [
      "failed_not_permitted",
      "not-permitted",
      "You don't have permission to change alert status",
      false,
      false,
    ],
    [
      "failed_read_only",
      "read-only",
      "Keep is in read-only mode.",
      false,
      false,
    ],
    [
      "failed_unauthenticated",
      "error",
      "Your session expired before the change was made.",
      false,
      false,
    ],
    [
      "failed_interrupted",
      "error",
      "The change was interrupted and no alert was changed.",
      false,
      false,
    ],
    [
      "failed_outcome_unknown",
      "error",
      "The result of this change could not be determined.",
      false,
      false,
    ],
    ["discarded", "declined", "Discarded", false, false],
    ["expired", "expired", "Draft expired, ask again", false, false],
  ])("%s", (name, state, text, hasConfirm, hasDiscard) => {
    show(draft(name));
    expect(card()).toHaveAttribute("data-state", state);
    if (text) {
      expect(outcome()).toHaveTextContent(text);
    } else {
      expect(outcome()).toBeNull();
    }
    expect(!!confirmButton()).toBe(hasConfirm);
    expect(!!discardButton()).toBe(hasDiscard);
  });

  it("not here yet is a skeleton", () => {
    show(null);
    expect(card()).toHaveAttribute("data-state", "streaming");
    expect(card()).toHaveAttribute("aria-busy", "true");
    expect(confirmButton()).toBeNull();
  });

  it("read-only mode takes the Confirm away", () => {
    (useConfig as jest.Mock).mockReturnValue({ data: { READ_ONLY: true } });
    show(draft("pending"));
    expect(card()).toHaveAttribute("data-state", "read-only");
    expect(outcome()).toHaveTextContent("Keep is in read-only mode.");
    expect(confirmButton()).toBeNull();
    expect(discardButton()).toBeEnabled();
  });

  it("expires while it is on screen", () => {
    show(draft("pending"));
    act(() => jest.advanceTimersByTime(25 * 60_000 - 1));
    expect(card()).toHaveAttribute("data-state", "draft");
    act(() => jest.advanceTimersByTime(100));
    expect(card()).toHaveAttribute("data-state", "expired");
    expect(confirmButton()).toBeNull();
    expect(discardButton()).toBeNull();
  });

  it("looks unsaved only until it is confirmed", () => {
    const { update } = show(draft("pending"));
    expect(screen.getByText("Draft · not saved")).toBeInTheDocument();
    expect(card()).toHaveClass("border-dashed", "border-orange-400");
    update(draft("applied"));
    expect(screen.queryByText("Draft · not saved")).toBeNull();
    expect(card()).toHaveClass("border-green-500");
    expect(card()).not.toHaveClass("border-dashed");
  });

  it("discarded keeps one line", () => {
    show(draft("discarded"));
    expect(card().textContent).toBe("Discarded");
  });
});

describe("what would be changed", () => {
  it("lists every alert, its severity and the status it has now", () => {
    show(draft("pending"));
    const list = within(screen.getByRole("list", { name: "Alerts" }));
    expect(list.getAllByRole("listitem").map((row) => row.textContent)).toEqual(
      [
        "High CPU on prod-db-01critical",
        'Disk almost full ‹prod-db-02› "data" éwarning',
        // No name: its fingerprint
        "5d41402abc4b2a76b9719d911017c592",
      ]
    );
    const changes = within(
      screen.getByRole("list", { name: "Status changes" })
    );
    expect(
      changes.getAllByRole("listitem").map((row) => row.textContent)
    ).toEqual(["firingacknowledged2 alerts", "unknownacknowledged1 alert"]);
  });

  it("says what is left out", () => {
    show(draft("pending"));
    expect(card()).toHaveTextContent("2 already acknowledged, skipped");
    expect(card()).toHaveTextContent("1 not found: gone");
    expect(card()).toHaveTextContent("1 could not be looked up: team/alert");
  });

  it("says nothing about what is not left out", () => {
    show(
      draft("pending", {
        skipped: [],
        not_found: [],
        unresolvable: [],
        note: null,
      })
    );
    ["skipped", "not found", "looked up", "Note", "Replaces"].forEach((text) =>
      expect(card()).not.toHaveTextContent(text)
    );
  });

  it.each([
    [1, "Replaces the note on 1 alert"],
    [2, "Replaces the note on 2 alerts"],
  ])("warns about %d notes it replaces", (count, text) => {
    show(
      draft("pending", {
        alerts: alerts.map((alert, index) => ({
          ...alert,
          has_note: index < count,
        })),
      })
    );
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it.each([
    [{ note: null }],
    [{ alerts: alerts.map((alert) => ({ ...alert, has_note: false })) }],
  ])("does not warn when no note is replaced", (payload) => {
    show(draft("pending", payload));
    expect(card()).not.toHaveTextContent("Replaces the note");
  });

  it.each([
    ["resolved", true, true],
    ["resolved", null, false],
    ["resolved", false, false],
    ["acknowledged", true, false],
  ])(
    "to %s with has_incident %s: incident hint %s",
    (target_status, has_incident, isShown) => {
      show(
        draft("pending", {
          target_status,
          alerts: [{ ...alerts[0], has_incident }],
        })
      );
      const hint = screen.queryByText(/belong to an incident/);
      expect(!!hint).toBe(isShown);
    }
  );

  it.each([
    [true, "Disposes the status when a new alert comes in"],
    [false, "Keeps the status when a new alert comes in"],
  ])("with dispose_on_new_alert %s", (dispose_on_new_alert, text) => {
    show(draft("pending", { dispose_on_new_alert }));
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("has the exact change on the button", () => {
    show(
      draft("pending", {
        alerts: Array.from({ length: 10 }, (_, index) => ({
          ...alerts[0],
          fingerprint: `fp-${index}`,
        })),
      })
    );
    expect(confirmButton()).toHaveTextContent("Acknowledge 10 alerts");
  });

  it("shows the note and the outcome as plain text", () => {
    const text = "<img src=x onerror=alert(1)> [link](https://evil.test) **b**";
    const { update } = show(draft("pending", { note: text }));
    expect(screen.getByText(text)).toBeInTheDocument();

    const failed = draft("failed", { note: null });
    update({
      ...failed,
      outcome: { ...failed.outcome!, message: text },
    });
    expect(outcome()).toHaveTextContent(text);
    expect(card().querySelector("img, a, strong")).toBeNull();
  });

  it("isolates the text of the alerts from the text around it", () => {
    show(draft("pending"));
    expect(screen.getByText(alerts[0].name as string).tagName).toBe("BDI");
  });

  it.each([["not a date"], [null], [undefined], [""]])(
    "does not need the expiry: %j",
    (expires_at) => {
      show({ ...draft("pending"), expires_at: expires_at as string });
      expect(card()).toHaveAttribute("data-state", "draft");
      expect(card()).not.toHaveTextContent(/Expires|Invalid/);
    }
  );
});

describe("what became of it", () => {
  const lists = () =>
    within(outcome() as HTMLElement)
      .queryAllByRole("list")
      .map((list) => [
        list.previousElementSibling?.textContent,
        within(list)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ]);

  it("lists the alerts by result when some were changed", () => {
    show(draft("partially_applied"));
    expect(lists()).toEqual([
      ["Changed (1)", ["High CPU on prod-db-01"]],
      ["Not changed (1)", ['Disk almost full ‹prod-db-02› "data" é']],
      ["Not confirmed (1)", ["5d41402abc4b2a76b9719d911017c592"]],
    ]);
  });

  it("does not list them again when all were changed", () => {
    show(draft("applied"));
    expect(lists()).toEqual([]);
  });

  it("lists what could not be checked", () => {
    show(draft("applied_unverified"));
    expect(lists().map(([label]) => label)).toEqual(["Not confirmed (3)"]);
  });

  it("has no time when it did not finish", () => {
    const view = draft("failed");
    show({ ...view, outcome: { ...view.outcome!, finished_at: null } });
    expect(outcome()?.textContent).toMatch(/^No alert was changed\.Not/);
  });
});

describe("a kind of draft this build does not know", () => {
  it.each([
    ["kind", { ...draft("pending"), kind: "silence_alerts" }],
    ["inherited name", { ...draft("pending"), kind: "constructor" }],
    ["version", draft("pending", { version: 2 })],
  ])("%s can only be discarded", (_, view) => {
    show(view);
    expect(confirmButton()).toBeNull();
    expect(discardButton()).toBeEnabled();
    expect(card()).toHaveTextContent("can't be confirmed here");
    expect(card()).toHaveTextContent('"target_status": "acknowledged"');
  });
});

describe("a draft of a newer gateway", () => {
  const future = (name: keyof typeof golden.future.drafts) =>
    golden.future.drafts[name] as unknown as DraftView;

  it("pending can only be discarded", () => {
    show(future("pending"));
    expect(card()).toHaveAttribute("data-state", "draft");
    expect(confirmButton()).toBeNull();
    expect(discardButton()).toBeEnabled();
    expect(card()).toHaveTextContent('"title": "Quiet hours"');
  });

  it("applied shows its outcome as the gateway wrote it, and no link", () => {
    show(future("applied"));
    expect(card()).toHaveAttribute("data-state", "saved");
    expect(outcome()).toHaveTextContent("The quiet hours were saved.");
    // Its result is not one this build knows: listed, not dropped
    const lists = within(outcome() as HTMLElement).getAllByRole("list");
    expect(lists).toHaveLength(1);
    expect(lists[0].previousElementSibling).toHaveTextContent("Other (1)");
    expect(lists[0]).toHaveTextContent("High CPU on prod-db-01");
    expect(byCy("assistant-draft-object-link")).toBeNull();
    expect(within(card()).queryByRole("link")).toBeNull();
  });
});

describe("the object an outcome names", () => {
  const withOutcome = (
    state: DraftView["state"],
    value: DraftView["outcome"]
  ): DraftView => ({ ...draft("applied"), state, outcome: value });
  const objectOutcome = (name: keyof typeof golden.outcomes) =>
    golden.outcomes[name] as DraftView["outcome"];
  const link = () => byCy("assistant-draft-object-link");

  it.each<[keyof typeof golden.outcomes, string, string]>([
    ["preset_saved", "Open Night shift", "/alerts/night-shift"],
    ["correlation_rule_saved", "Open Database storms", "/rules"],
  ])("%s links to it", (name, text, href) => {
    show(withOutcome("applied", objectOutcome(name)));
    expect(outcome()).toHaveTextContent(objectOutcome(name)!.message);
    expect(link()).toHaveTextContent(text);
    expect(link()).toHaveAttribute("href", href);
  });

  it("links to a known object of a failed draft too", () => {
    show(withOutcome("failed", objectOutcome("stale_draft")));
    expect(card()).toHaveAttribute("data-state", "error");
    expect(link()).toHaveTextContent("Open On call");
  });

  it("isolates the object's name from the text around it", () => {
    show(withOutcome("applied", objectOutcome("preset_saved")));
    expect(within(link() as HTMLElement).getByText("Night shift").tagName).toBe(
      "BDI"
    );
  });

  it.each(["dashboard_saved", "object_gone", "name_taken"] as const)(
    "%s has no link without a path",
    (name) => {
      show(withOutcome("failed", objectOutcome(name)));
      expect(link()).toBeNull();
    }
  );

  const preset = golden.outcomes.preset_saved;
  it.each<[string, object]>([
    [
      "an incident, which this build does not know",
      {
        type: "incident",
        id: "00000000-0000-4000-8000-000000000060",
        name: "Database down",
        path: "/incidents/00000000-0000-4000-8000-000000000060",
      },
    ],
    ["a type of a newer gateway", { ...preset.object, type: "constructor" }],
    ["another host", { ...preset.object, path: "//evil.test/alerts/x" }],
    ["a backslash host", { ...preset.object, path: "/\\evil.test" }],
    ["a script", { ...preset.object, path: "javascript:alert(1)" }],
    ["a full address", { ...preset.object, path: "https://evil.test/alerts" }],
    ["another page", { ...preset.object, path: "/settings" }],
    ["a page that starts the same", { ...preset.object, path: "/alertsx/y" }],
    ["a control character", { ...preset.object, path: "/alerts/a\nb" }],
    ["a path that is not text", { ...preset.object, path: 7 }],
  ])("is no link for %s", (_, object) => {
    show(
      withOutcome("applied", {
        ...preset,
        message: "Done.",
        object,
      } as DraftView["outcome"])
    );
    expect(outcome()).toHaveTextContent("Done.");
    expect(link()).toBeNull();
  });

  it("names what it is when it has no name", () => {
    show(
      withOutcome("applied", {
        ...preset,
        object: { ...preset.object, name: null },
      } as DraftView["outcome"])
    );
    expect(link()).toHaveTextContent("Open the preset");
  });
});

describe("a draft opened in the form", () => {
  const opened = (): DraftView => ({
    ...draft("discarded"),
    outcome: golden.outcomes.opened_in_form as DraftView["outcome"],
  });

  it("says so instead of Discarded", () => {
    show(opened());
    expect(card()).toHaveAttribute("data-state", "declined");
    // All that is left is the outcome, and when it happened
    expect(card().textContent).toMatch(
      /^Opened in the form, to finish there\. · [^·]+$/
    );
    expect(card()).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/^Opened in form:/)
    );
  });

  it("is still Discarded with another outcome", () => {
    show({
      ...draft("discarded"),
      outcome: golden.outcomes.name_taken as DraftView["outcome"],
    });
    expect(card().textContent).toMatch(/^Discarded · [^·]+$/);
    expect(card()).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/^Discarded:/)
    );
  });
});

describe("Confirm", () => {
  it("disables both buttons, keeps the focus and announces the result", async () => {
    let resolve: (view: DraftView) => void = () => {};
    post.mockReturnValue(new Promise((done) => (resolve = done)));
    const { update } = show(draft("pending"));
    confirmButton()?.focus();
    await click(confirmButton());

    expect(card()).toHaveAttribute("data-state", "submitting");
    expect(card()).toHaveAttribute("aria-busy", "true");
    expect(confirmButton()).toBeDisabled();
    expect(discardButton()).toBeDisabled();
    expect(card()).toHaveFocus();

    await act(async () => resolve(draft("applied")));
    expect(onChange).toHaveBeenCalledWith(draft("applied"));
    update(draft("applied"));
    expect(screen.getByRole("status")).toHaveTextContent(
      "All alerts were changed."
    );
    expect(card()).toHaveFocus();
  });

  it("can be pressed again when Keep was not reached", async () => {
    const { status, body } = golden.errors.gateway_unavailable;
    post.mockRejectedValue(
      new KeepApiError(body.detail, "/x", "", body, status)
    );
    show(draft("pending"));
    await click(confirmButton());
    expect(card()).toHaveAttribute("data-state", "draft");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Couldn't reach Keep, try again."
    );
    expect(confirmButton()).toBeEnabled();
  });

  it("drops its error once the draft moves on", async () => {
    post.mockRejectedValue(new TypeError("Failed to fetch"));
    const { update } = show(draft("pending"));
    await click(confirmButton());
    expect(onUncertain).toHaveBeenCalledTimes(1);
    update(draft("applying"));
    expect(card()).not.toHaveTextContent("Couldn't reach Keep");
    update(draft("applied"));
    expect(card()).not.toHaveTextContent("Couldn't reach Keep");
  });
});

describe("Discard", () => {
  it("is sent, and disables Confirm meanwhile", async () => {
    post.mockReturnValue(new Promise(() => {}));
    show(draft("pending"));
    await click(discardButton());
    expect(post).toHaveBeenCalledWith(
      `/assistant/drafts/${golden.drafts.pending.id}/discard`
    );
    expect(confirmButton()).toBeDisabled();
    expect(card()).toHaveAttribute("data-state", "draft");
  });
});

describe("a change that takes long", () => {
  it("offers to check again once the page stopped waiting", async () => {
    show(draft("applying"), { isTimedOut: true });
    expect(outcome()).toHaveTextContent("longer than usual");
    await click(byCy("assistant-draft-check-again"));
    expect(onCheckAgain).toHaveBeenCalledWith(golden.drafts.applying.id);
  });

  it.each<[GoldenDraft, boolean]>([
    ["applying", false],
    ["applied", true],
  ])("does not offer it for %s", (name, isTimedOut) => {
    show(draft(name), { isTimedOut });
    expect(byCy("assistant-draft-check-again")).toBeNull();
  });
});
