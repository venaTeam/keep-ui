import {
  ALERT_REFETCH_DEBOUNCE_MS,
  ALERT_REFETCH_MAX_WAIT_MS,
  RefetchTimers,
  clearRefetchTimers,
  scheduleRefetchWithMaxWait,
} from "../refetch-scheduler";

describe("scheduleRefetchWithMaxWait", () => {
  let timers: RefetchTimers;
  let refetch: jest.Mock;

  const schedule = () => scheduleRefetchWithMaxWait(timers, refetch);

  beforeEach(() => {
    jest.useFakeTimers();
    timers = { debounce: null, maxWait: null };
    refetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fires once after the debounce interval for a single event", () => {
    schedule();
    jest.advanceTimersByTime(ALERT_REFETCH_DEBOUNCE_MS - 1);
    expect(refetch).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("does not fire a second time from the max-wait timer after a debounce flush", () => {
    schedule();
    jest.advanceTimersByTime(ALERT_REFETCH_MAX_WAIT_MS * 2);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("fires at the max-wait deadline when events keep resetting the debounce", () => {
    const eventIntervalMs = 200;
    for (let t = 0; t < ALERT_REFETCH_MAX_WAIT_MS; t += eventIntervalMs) {
      schedule();
      jest.advanceTimersByTime(eventIntervalMs);
    }
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps firing roughly every max-wait interval during a sustained storm", () => {
    const eventIntervalMs = 200;
    const stormDurationMs = 10_000;
    for (let t = 0; t < stormDurationMs; t += eventIntervalMs) {
      schedule();
      jest.advanceTimersByTime(eventIntervalMs);
    }
    const minExpected = Math.floor(
      stormDurationMs / (ALERT_REFETCH_MAX_WAIT_MS + eventIntervalMs)
    );
    expect(refetch.mock.calls.length).toBeGreaterThanOrEqual(minExpected);
    jest.advanceTimersByTime(ALERT_REFETCH_DEBOUNCE_MS);
    expect(refetch.mock.calls.length).toBeGreaterThanOrEqual(minExpected + 1);
  });

  it("re-arms the max-wait deadline after each flush", () => {
    schedule();
    jest.advanceTimersByTime(ALERT_REFETCH_MAX_WAIT_MS);
    expect(refetch).toHaveBeenCalledTimes(1);

    const eventIntervalMs = 200;
    for (let t = 0; t < ALERT_REFETCH_MAX_WAIT_MS; t += eventIntervalMs) {
      schedule();
      jest.advanceTimersByTime(eventIntervalMs);
    }
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("honors custom debounce and max-wait intervals", () => {
    const eventIntervalMs = 50;
    for (let t = 0; t < 300; t += eventIntervalMs) {
      scheduleRefetchWithMaxWait(timers, refetch, 100, 300);
      jest.advanceTimersByTime(eventIntervalMs);
    }
    expect(refetch).toHaveBeenCalledTimes(1);
    scheduleRefetchWithMaxWait(timers, refetch, 100, 300);
    jest.advanceTimersByTime(100);
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to the default intervals when overrides are undefined", () => {
    scheduleRefetchWithMaxWait(timers, refetch, undefined, undefined);
    jest.advanceTimersByTime(ALERT_REFETCH_DEBOUNCE_MS - 1);
    expect(refetch).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("uses the latest refetch callback armed for the pending debounce", () => {
    const first = jest.fn();
    const second = jest.fn();
    scheduleRefetchWithMaxWait(timers, first);
    scheduleRefetchWithMaxWait(timers, second);
    jest.advanceTimersByTime(ALERT_REFETCH_DEBOUNCE_MS + 1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("uses the latest refetch callback for a storm-driven max-wait flush", () => {
    const first = jest.fn();
    const second = jest.fn();
    const eventIntervalMs = 200;
    scheduleRefetchWithMaxWait(timers, first);
    for (let t = 0; t < ALERT_REFETCH_MAX_WAIT_MS; t += eventIntervalMs) {
      jest.advanceTimersByTime(eventIntervalMs);
      scheduleRefetchWithMaxWait(timers, second);
    }
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("clearRefetchTimers cancels every pending flush", () => {
    schedule();
    clearRefetchTimers(timers);
    jest.advanceTimersByTime(ALERT_REFETCH_MAX_WAIT_MS * 2);
    expect(refetch).not.toHaveBeenCalled();
    expect(timers.debounce).toBeNull();
    expect(timers.maxWait).toBeNull();
  });
});
