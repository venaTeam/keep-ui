import { fireEvent, render, screen } from "@testing-library/react";
import { AlertDto, Status } from "@/entities/alerts/model/types";
import { QuickActionTray } from "../quick-action-tray";
import { QUICK_TRAY_CLASS } from "../class-names";

jest.mock("../action-dialogs", () => ({
  ChangeStatusDialog: () => null,
  LinkIncidentDialog: () => null,
  DismissDialog: () => null,
}));

const alert = (fields: Record<string, unknown>) =>
  ({
    id: "a",
    fingerprint: "fp",
    name: "disk-full",
    status: Status.Firing,
    lastReceived: "2026-11-16T10:00:00Z",
    source: ["prometheus"],
    ...fields,
  }) as unknown as AlertDto;

const firingNoIncident = alert({ fingerprint: "fp-firing" });
const inIncident = alert({
  fingerprint: "fp-incident",
  incident_dto: [{ id: "i1", is_candidate: false, status: "firing" }],
});
const suppressed = alert({
  fingerprint: "fp-suppressed",
  status: Status.Suppressed,
});
const onOpen = jest.fn();

beforeEach(() => jest.clearAllMocks());

describe("QuickActionTray", () => {
  it("marks its root with the tray class the reveal styles target", () => {
    const { container } = render(
      <QuickActionTray alert={firingNoIncident} onOpen={onOpen} />
    );
    expect(container.firstElementChild).toHaveClass(QUICK_TRAY_CLASS);
  });

  it("hangs below its anchor, and above it when data-placement is above", () => {
    const { container } = render(
      <QuickActionTray alert={firingNoIncident} onOpen={onOpen} />
    );
    expect(container.firstElementChild).toHaveClass(
      "absolute",
      "right-1",
      "top-full",
      "data-[placement=above]:top-auto",
      "data-[placement=above]:bottom-full"
    );
    expect(container.firstElementChild).not.toHaveAttribute("style");
  });

  it("hands its root, with the tray class, to ref", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<QuickActionTray alert={firingNoIncident} onOpen={onOpen} ref={ref} />);
    expect(ref.current).toHaveClass(QUICK_TRAY_CLASS);
  });

  it("shows all three for a firing alert with no incident", () => {
    render(<QuickActionTray alert={firingNoIncident} onOpen={onOpen} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Change Status",
      "Link to incident",
      "Dismiss",
    ]);
  });

  it("renders plain buttons with per-action hooks", () => {
    render(<QuickActionTray alert={firingNoIncident} onOpen={onOpen} />);
    expect(
      screen
        .getAllByRole("button")
        .map((b) => [b.getAttribute("type"), b.getAttribute("data-cy")])
    ).toEqual([
      ["button", "widget-quick-action-change-status"],
      ["button", "widget-quick-action-link-incident"],
      ["button", "widget-quick-action-dismiss"],
    ]);
  });

  it("offers Link for an alert already in a live incident", () => {
    render(<QuickActionTray alert={inIncident} onOpen={onOpen} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: `Link to incident: ${inIncident.name}`,
      })
    );
    expect(onOpen).toHaveBeenCalledWith("link-incident", [inIncident], null);
  });

  it("hides Dismiss for a suppressed alert", () => {
    render(<QuickActionTray alert={suppressed} onOpen={onOpen} />);
    expect(screen.queryByRole("button", { name: /^Dismiss/ })).toBeNull();
  });

  it("opens the action for that one alert without reaching the row", () => {
    const rowClick = jest.fn();
    render(
      <div onClick={rowClick}>
        <QuickActionTray alert={firingNoIncident} onOpen={onOpen} />
      </div>
    );
    fireEvent.click(
      screen.getByRole("button", { name: `Dismiss: ${firingNoIncident.name}` })
    );
    expect(onOpen).toHaveBeenCalledWith("dismiss", [firingNoIncident], null);
    expect(rowClick).not.toHaveBeenCalled();
  });

  it("hands over the button a mouse pressed, and null for a keyboard press", () => {
    render(<QuickActionTray alert={firingNoIncident} onOpen={onOpen} />);
    const button = screen.getByRole("button", {
      name: `Dismiss: ${firingNoIncident.name}`,
    });

    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 0 });

    expect(onOpen.mock.calls).toEqual([
      ["dismiss", [firingNoIncident], button],
      ["dismiss", [firingNoIncident], null],
    ]);
  });

  it("shows icons only when compact, keeping accessible names", () => {
    render(
      <QuickActionTray alert={firingNoIncident} compact onOpen={onOpen} />
    );
    const button = screen.getByRole("button", {
      name: `Change Status: ${firingNoIncident.name}`,
    });
    expect(button.textContent).toBe("");
    expect(button).toHaveAttribute("title", "Change Status");
  });
});
