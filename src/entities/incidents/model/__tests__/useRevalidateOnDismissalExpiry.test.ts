import { act, renderHook } from "@testing-library/react";
import { IncidentDto, Status } from "../models";
import {
  MAX_RETRIES,
  getDismissalExpiryDelay,
  parseDeadline,
  useRevalidateOnDismissalExpiry,
} from "../useRevalidateOnDismissalExpiry";

const NOW = Date.parse("2026-11-17T12:00:00.000Z");

function incident(overrides: Partial<IncidentDto>): IncidentDto {
  return {
    id: "1",
    status: Status.Firing,
    dismiss_mode: null,
    dismissed_until: null,
    ...overrides,
  } as IncidentDto;
}

function dismissedUntil(msFromNow: number): IncidentDto {
  return incident({
    status: Status.Suppressed,
    dismiss_mode: "dismiss_until",
    dismissed_until: new Date(NOW + msFromNow).toISOString(),
  });
}

describe("getDismissalExpiryDelay", () => {
  it("is null when nothing is dismissed until a deadline", () => {
    expect(
      getDismissalExpiryDelay(
        [
          incident({}),
          incident({ status: Status.Suppressed, dismiss_mode: "permanent" }),
        ],
        NOW
      )
    ).toBeNull();
  });

  it("ignores a lapsed deadline once the incident no longer reads suppressed", () => {
    const lapsed = incident({
      status: Status.Firing,
      dismiss_mode: "dismiss_until",
      dismissed_until: new Date(NOW - 60_000).toISOString(),
    });
    expect(getDismissalExpiryDelay([lapsed], NOW)).toBeNull();
  });

  it("waits for the earliest deadline plus a grace second", () => {
    expect(
      getDismissalExpiryDelay(
        [dismissedUntil(120_000), dismissedUntil(30_000)],
        NOW
      )
    ).toBe(31_000);
  });

  it("retries when a passed deadline still reads suppressed", () => {
    expect(getDismissalExpiryDelay([dismissedUntil(-1)], NOW)).toBe(5000);
  });

  it("backs off while a passed deadline keeps reading suppressed, then stops", () => {
    const lapsed = [dismissedUntil(-1)];
    const delays = Array.from({ length: MAX_RETRIES + 1 }, (_, retries) =>
      getDismissalExpiryDelay(lapsed, NOW, retries)
    );
    expect(delays).toEqual([5000, 10_000, 20_000, 40_000, 60_000, 60_000, null]);
  });

  it("caps the delay at what setTimeout can hold", () => {
    expect(
      getDismissalExpiryDelay([dismissedUntil(60 * 24 * 3600 * 1000)], NOW)
    ).toBe(2 ** 31 - 1);
  });
});

describe("parseDeadline", () => {
  it("reads a deadline without a timezone as UTC", () => {
    expect(parseDeadline("2026-11-17T12:00:00")).toBe(NOW);
    expect(parseDeadline("2026-11-17T12:00:00.000")).toBe(NOW);
  });

  it("honours an explicit timezone", () => {
    expect(parseDeadline("2026-11-17T12:00:00Z")).toBe(NOW);
    expect(parseDeadline("2026-11-17T14:00:00+02:00")).toBe(NOW);
    expect(parseDeadline("2026-11-17T12:00:00.000000+00:00")).toBe(NOW);
  });
});

describe("useRevalidateOnDismissalExpiry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("revalidates once the dismissal lapses", () => {
    const revalidate = jest.fn();
    renderHook(() =>
      useRevalidateOnDismissalExpiry([dismissedUntil(10_000)], revalidate)
    );

    act(() => {
      jest.advanceTimersByTime(10_999);
    });
    expect(revalidate).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("keeps retrying while the refetch still reads suppressed", () => {
    const revalidate = jest.fn();
    const incidents = [dismissedUntil(10_000)];
    renderHook(() => useRevalidateOnDismissalExpiry(incidents, revalidate));

    act(() => {
      jest.advanceTimersByTime(11_000);
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last retry", () => {
    const revalidate = jest.fn();
    const incidents = [dismissedUntil(10_000)];
    renderHook(() => useRevalidateOnDismissalExpiry(incidents, revalidate));

    // the deadline, then every retry, then an hour of nothing
    act(() => {
      jest.advanceTimersByTime(11_000);
    });
    for (let i = 0; i < MAX_RETRIES + 2; i++) {
      act(() => {
        jest.advanceTimersByTime(60_000);
      });
    }
    act(() => {
      jest.advanceTimersByTime(3_600_000);
    });

    expect(revalidate).toHaveBeenCalledTimes(1 + MAX_RETRIES);
  });

  it("does nothing while paused", () => {
    const revalidate = jest.fn();
    renderHook(() =>
      useRevalidateOnDismissalExpiry([dismissedUntil(10_000)], revalidate, true)
    );

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("stops once the incident reads firing again", () => {
    const revalidate = jest.fn();
    const { rerender } = renderHook(
      ({ incidents }) => useRevalidateOnDismissalExpiry(incidents, revalidate),
      { initialProps: { incidents: [dismissedUntil(10_000)] } }
    );

    act(() => {
      jest.advanceTimersByTime(11_000);
    });
    rerender({ incidents: [incident({})] });
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(revalidate).toHaveBeenCalledTimes(1);
  });
});
