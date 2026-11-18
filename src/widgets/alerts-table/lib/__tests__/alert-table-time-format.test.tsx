import React, { useEffect, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { formatDateTime } from "../alert-table-time-format";

const START = new Date("2026-11-18T12:00:00.000Z");
const POLL_MS = 30_000;

/**
 * Formats the same instant on every render and re-renders itself every
 * 30 s, like the dashboard Alert Table widget's poll.
 */
function PollingCell({ isoString }: { isoString: string }) {
  const [, setPolls] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPolls((polls) => polls + 1), POLL_MS);
    return () => clearInterval(id);
  }, []);
  return <span data-testid="cell">{formatDateTime(isoString, "timeago")}</span>;
}

/**
 * Advances fake time one second per act() so every timer that fires gets
 * rendered, and its effects rescheduled, before the next one is due.
 */
const advanceSeconds = (seconds: number) => {
  for (let i = 0; i < seconds; i++) {
    act(() => {
      jest.advanceTimersByTime(1000);
    });
  }
};

describe("formatDateTime", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps a timeago date counting while the table re-renders every 30 s", () => {
    render(<PollingCell isoString={START.toISOString()} />);

    for (let poll = 0; poll < 6; poll++) {
      advanceSeconds(POLL_MS / 1000);
    }

    expect(screen.getByTestId("cell")).toHaveTextContent("3 minutes ago");
  });

  it("renders Invalid date for an unparseable value", () => {
    render(
      <span data-testid="cell">{formatDateTime("not-a-date", "timeago")}</span>
    );
    expect(screen.getByTestId("cell")).toHaveTextContent("Invalid date");
  });
});
