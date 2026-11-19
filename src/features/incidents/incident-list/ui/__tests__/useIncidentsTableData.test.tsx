import { renderHook } from "@testing-library/react";
import { useRevalidateOnDismissalExpiry } from "@/entities/incidents/model";
import { useIncidents, usePollIncidents } from "@/utils/hooks/useIncidents";
import { useIncidentsTableData } from "../useIncidentsTableData";

jest.mock("@/utils/hooks/useIncidents", () => ({
  useIncidents: jest.fn(),
  usePollIncidents: jest.fn(),
}));
jest.mock("@/entities/incidents/model", () => ({
  useRevalidateOnDismissalExpiry: jest.fn(),
}));

const SUPPRESSED_ON_ANOTHER_FILTER = {
  id: "dismissed",
  status: "suppressed",
  dismiss_mode: "dismiss_until",
  dismissed_until: "2030-01-01T00:00:00Z",
};
const FIRING_ON_SCREEN = { id: "firing", status: "firing" };

function isNextExpiryQuery(query: any) {
  return query?.sorting?.id === "dismissed_until";
}

// SWR hands back the same objects until the data changes; the hook keeps them
// in state, so fresh objects per render would re-render forever.
function swrResult(items: any[]) {
  return {
    data: { items, count: items.length },
    isLoading: false,
    mutate: jest.fn(),
    error: undefined,
    responseTimeMs: 0,
  };
}
const NEXT_EXPIRY_RESULT = swrResult([SUPPRESSED_ON_ANOTHER_FILTER]);
const LIST_RESULT = swrResult([FIRING_ON_SCREEN]);
const POLL_RESULT = { incidentChangeToken: undefined };
// One object, as the list's state would hold it: the hook keys effects on
// `sorting`'s identity.
const DEFAULT_VIEW = {
  candidate: null,
  predicted: null,
  limit: 20,
  offset: 0,
  sorting: { id: "creation_time", desc: true },
  filterCel: "status in ['firing', 'acknowledged']",
  timeFrame: null,
};

describe("useIncidentsTableData", () => {
  beforeEach(() => {
    (usePollIncidents as jest.Mock).mockReturnValue(POLL_RESULT);
    (useIncidents as jest.Mock).mockImplementation((query: any) =>
      isNextExpiryQuery(query) ? NEXT_EXPIRY_RESULT : LIST_RESULT
    );
  });

  it("asks for the earliest live dismiss-until regardless of the list's filter", () => {
    renderHook(() => useIncidentsTableData(DEFAULT_VIEW));

    const nextExpiryQuery = (useIncidents as jest.Mock).mock.calls
      .map(([query]) => query)
      .find(isNextExpiryQuery);
    expect(nextExpiryQuery).toMatchObject({
      candidate: false,
      limit: 1,
      sorting: { id: "dismissed_until", desc: false },
      cel: "status == 'suppressed' && dismiss_mode == 'dismiss_until'",
    });
  });

  it("arms the expiry timer with that incident even when it isn't on screen", () => {
    renderHook(() => useIncidentsTableData(DEFAULT_VIEW));

    const calls = (useRevalidateOnDismissalExpiry as jest.Mock).mock.calls;
    const [incidents] = calls[calls.length - 1];
    expect(incidents).toEqual(
      expect.arrayContaining([SUPPRESSED_ON_ANOTHER_FILTER])
    );
  });
});
