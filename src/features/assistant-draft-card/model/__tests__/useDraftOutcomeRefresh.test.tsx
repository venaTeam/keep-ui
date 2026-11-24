import { renderHook } from "@testing-library/react";
import { DraftView } from "@/entities/assistant";
import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";
import { useDraftOutcomeRefresh } from "../useDraftOutcomeRefresh";

const mockRevalidate = jest.fn();
jest.mock("@/shared/lib/state-utils", () => ({
  useRevalidateMultiple: () => mockRevalidate,
}));

const ID = golden.drafts.pending.id;
const draft = (name: keyof typeof golden.drafts, id = ID) =>
  ({ ...golden.drafts[name], id }) as unknown as DraftView;

const setup = (...drafts: DraftView[]) =>
  renderHook((props: DraftView[]) => useDraftOutcomeRefresh(props), {
    initialProps: drafts,
  });

beforeEach(() => mockRevalidate.mockClear());

it.each(["applied", "partially_applied", "applied_unverified"] as const)(
  "refreshes the alerts once when a draft becomes %s",
  (name) => {
    const { rerender } = setup(draft("pending"));
    rerender([draft("applying")]);
    expect(mockRevalidate).not.toHaveBeenCalled();

    rerender([draft(name)]);
    expect(mockRevalidate).toHaveBeenCalledTimes(1);
    expect(mockRevalidate).toHaveBeenCalledWith(["/alerts/query", "/preset"]);

    rerender([draft(name)]);
    expect(mockRevalidate).toHaveBeenCalledTimes(1);
  }
);

it.each([
  "applied_nothing_to_change",
  "failed",
  "failed_rejected",
  "failed_interrupted",
  "failed_outcome_unknown",
  "discarded",
  "expired",
] as const)("does not refresh when a draft becomes %s", (name) => {
  const { rerender } = setup(draft("pending"));
  rerender([draft(name)]);
  expect(mockRevalidate).not.toHaveBeenCalled();
});

it("does not refresh for drafts that were final from the start", () => {
  const { rerender } = setup(draft("applied"));
  rerender([draft("applied"), draft("applied", "other")]);
  expect(mockRevalidate).not.toHaveBeenCalled();
});

it("refreshes once for drafts that become final together", () => {
  const { rerender } = setup(draft("applying"), draft("applying", "other"));
  rerender([draft("applied"), draft("failed", "other")]);
  expect(mockRevalidate).toHaveBeenCalledTimes(1);
});
