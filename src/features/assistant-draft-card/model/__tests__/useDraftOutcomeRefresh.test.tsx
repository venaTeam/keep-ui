import { renderHook } from "@testing-library/react";
import { DraftView } from "@/entities/assistant";
import golden from "@/entities/assistant/__fixtures__/assistant_stream.json";
import { RefreshKey } from "../../lib/draft-presenter";
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

describe("the keys a kind names", () => {
  const setupWith = (
    refreshKeysOf: (draft: DraftView) => RefreshKey[],
    ...drafts: DraftView[]
  ) =>
    renderHook(
      (props: DraftView[]) => useDraftOutcomeRefresh(props, refreshKeysOf),
      { initialProps: drafts }
    );

  it("revalidates exact keys apart from prefixes", () => {
    const { rerender } = setupWith(
      () => [
        { key: "/dashboard", isExact: true },
        { key: "/preset", isExact: false },
      ],
      draft("pending")
    );
    rerender([draft("applied")]);
    expect(mockRevalidate).toHaveBeenCalledTimes(2);
    expect(mockRevalidate).toHaveBeenCalledWith(["/preset"]);
    expect(mockRevalidate).toHaveBeenCalledWith(["/dashboard"], {
      isExact: true,
    });
  });

  it("revalidates each key once for drafts that become final together", () => {
    const { rerender } = setupWith(
      () => [{ key: "/rules", isExact: true }],
      draft("pending"),
      draft("pending", "other")
    );
    rerender([draft("applied"), draft("applied", "other")]);
    expect(mockRevalidate).toHaveBeenCalledTimes(1);
    expect(mockRevalidate).toHaveBeenCalledWith(["/rules"], { isExact: true });
  });

  it("asks only about the drafts that just became final", () => {
    const refreshKeysOf = jest.fn(() => [] as RefreshKey[]);
    const { rerender } = setupWith(
      refreshKeysOf,
      draft("applied", "old"),
      draft("pending")
    );
    rerender([draft("applied", "old"), draft("failed")]);
    expect(refreshKeysOf).toHaveBeenCalledTimes(1);
    expect(refreshKeysOf).toHaveBeenCalledWith(
      expect.objectContaining({ id: ID, state: "failed" })
    );
    expect(mockRevalidate).not.toHaveBeenCalled();
  });
});
