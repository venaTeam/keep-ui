import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useLeaveGuard } from "../useLeaveGuard";
import {
  confirmNavigation,
  useNavigationGuardStore,
} from "@/shared/lib/navigation-guard";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

let blocked: Array<() => void> = [];

function Page({ enabled }: { enabled: boolean }) {
  useLeaveGuard(enabled, (proceed) => blocked.push(proceed));
  return (
    <div>
      <a href="/alerts/feed">feed</a>
      <a href="/alerts/feed" target="_blank">feed in new tab</a>
      <a href={window.location.pathname}>this page</a>
      <span>
        <a href="/incidents">
          <span>nested</span>
        </a>
      </span>
    </div>
  );
}

beforeEach(async () => {
  // Let a cleanup's pending history.back() from an earlier test land, so its
  // "dropping the copy" state does not leak into this one.
  window.dispatchEvent(new PopStateEvent("popstate"));
  await new Promise((resolve) => setTimeout(resolve));
  blocked = [];
  mockPush.mockReset();
  mockReplace.mockReset();
  window.history.replaceState(null, "", "/dashboard/Ops");
});

const clickLink = (text: string, init: MouseEventInit = {}) =>
  fireEvent.click(screen.getByText(text), { button: 0, ...init });

describe("useLeaveGuard links", () => {
  it("does nothing when disabled", () => {
    render(<Page enabled={false} />);
    clickLink("feed");
    expect(blocked).toHaveLength(0);
  });

  it("holds back a same-tab link and navigates only on proceed", () => {
    render(<Page enabled={true} />);
    clickLink("feed");
    expect(blocked).toHaveLength(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    act(() => blocked[0]());
    // The extra history entry is current, so it is replaced, not stacked.
    expect(mockReplace).toHaveBeenCalledWith("/alerts/feed");
  });

  it("catches clicks inside a link", () => {
    render(<Page enabled={true} />);
    clickLink("nested");
    expect(blocked).toHaveLength(1);
  });

  it("lets new-tab clicks through", () => {
    render(<Page enabled={true} />);
    clickLink("feed", { ctrlKey: true });
    clickLink("feed", { metaKey: true });
    clickLink("feed in new tab");
    expect(blocked).toHaveLength(0);
  });

  it("ignores links to the current page", () => {
    render(<Page enabled={true} />);
    clickLink("this page");
    expect(blocked).toHaveLength(0);
  });

  it("still runs the link's own onClick while holding it back", () => {
    const onClick = jest.fn();
    render(
      <>
        <Page enabled={true} />
        <a href="/workflows" onClick={onClick}>
          with handler
        </a>
      </>
    );
    clickLink("with handler");
    expect(onClick).toHaveBeenCalled();
    expect(blocked).toHaveLength(1);
  });

  it("stops holding back once proceed ran", () => {
    render(<Page enabled={true} />);
    clickLink("feed");
    act(() => blocked[0]());
    clickLink("feed");
    expect(blocked).toHaveLength(1);
  });
});

describe("useLeaveGuard confirmNavigation", () => {
  it("runs navigation directly when nothing guards", () => {
    const go = jest.fn();
    confirmNavigation(go);
    expect(go).toHaveBeenCalled();
  });

  it("holds back navigation done in code while enabled", () => {
    render(<Page enabled={true} />);
    const go = jest.fn();
    confirmNavigation(go);
    expect(go).not.toHaveBeenCalled();
    act(() => blocked[0]());
    expect(go).toHaveBeenCalled();
  });

  it("clears the guard when disabled again", () => {
    const { rerender } = render(<Page enabled={true} />);
    rerender(<Page enabled={false} />);
    expect(useNavigationGuardStore.getState().blockers).toHaveLength(0);
  });

  it("keeps an earlier guard working when a later one is removed", () => {
    const first: Array<() => void> = [];
    const second: Array<() => void> = [];
    function Guard({ on, into }: { on: boolean; into: Array<() => void> }) {
      useLeaveGuard(on, (proceed) => into.push(proceed));
      return null;
    }
    const { rerender } = render(
      <>
        <Guard on={true} into={first} />
        <Guard on={true} into={second} />
      </>
    );
    const go = jest.fn();
    confirmNavigation(go);
    expect(second).toHaveLength(1);
    expect(first).toHaveLength(0);

    rerender(
      <>
        <Guard on={true} into={first} />
        <Guard on={false} into={second} />
      </>
    );
    confirmNavigation(go);
    expect(first).toHaveLength(1);
    expect(go).not.toHaveBeenCalled();
  });
});

// Back from the extra entry lands on the real one: same URL, no marker.
const pressBack = () =>
  act(() => {
    window.history.replaceState(null, "", window.location.href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

describe("useLeaveGuard browser", () => {
  it("asks the browser to confirm reload or close only while enabled", () => {
    const { rerender } = render(<Page enabled={true} />);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    rerender(<Page enabled={false} />);
    const later = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });

  it("adds an extra history entry and holds back Back", () => {
    const go = jest.spyOn(window.history, "go").mockImplementation(() => {});
    render(<Page enabled={true} />);
    expect(window.history.state?.__keepLeaveGuard).toBe(true);

    pressBack();
    expect(blocked).toHaveLength(1);
    expect(go).not.toHaveBeenCalled();

    act(() => blocked[0]());
    expect(go).toHaveBeenCalledWith(-2);
    go.mockRestore();
  });

  it("goes to the home page when Back has no earlier page", () => {
    const go = jest.spyOn(window.history, "go").mockImplementation(() => {});
    const length = jest
      .spyOn(window.history, "length", "get")
      .mockReturnValue(2);
    render(<Page enabled={true} />);
    pressBack();
    act(() => blocked[0]());
    expect(go).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/");
    go.mockRestore();
    length.mockRestore();
  });

  it("lets Back through when it only steps through the page's own URLs", () => {
    render(<Page enabled={true} />);
    // Landed on the extra entry again, e.g. after a filter pushed `?range=`.
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(blocked).toHaveLength(0);
  });

  it("does not ask when its own cleanup lands after turning on again", () => {
    const back = jest.spyOn(window.history, "back").mockImplementation(() => {});
    const { rerender } = render(<Page enabled={true} />);
    rerender(<Page enabled={false} />);
    rerender(<Page enabled={true} />);
    back.mockRestore();
    // The cleanup's history.back() arrives now, landing on the real entry.
    pressBack();
    expect(blocked).toHaveLength(0);
    expect(window.history.state?.__keepLeaveGuard).toBe(true);
    // A real Back afterwards is held back as usual.
    pressBack();
    expect(blocked).toHaveLength(1);
  });

  it("drops the extra history entry when disabled without leaving", () => {
    const back = jest.spyOn(window.history, "back").mockImplementation(() => {});
    const { rerender } = render(<Page enabled={true} />);
    rerender(<Page enabled={false} />);
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });
});
