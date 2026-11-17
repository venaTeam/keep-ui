import { act, renderHook } from "@testing-library/react";
import { IncidentDto, Status } from "../models";
import {
  getDismissalExpiryDelay,
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

  it("caps the delay at what setTimeout can hold", () => {
    expect(
      getDismissalExpiryDelay([dismissedUntil(60 * 24 * 3600 * 1000)], NOW)
    ).toBe(2 ** 31 - 1);
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
