import { fireEvent, render, screen } from "@testing-library/react";
import { AlertDto, Status } from "@/entities/alerts/model/types";
import { SelectionStrip } from "../selection-strip";

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

const [a, b, c, d] = ["a", "b", "c", "d"].map((fp) =>
  alert({ fingerprint: fp })
);
const [noInc1, noInc2, noInc3] = ["n1", "n2", "n3"].map((fp) =>
  alert({ fingerprint: fp })
);
const inIncident = alert({
  fingerprint: "in-incident",
  incident_dto: [{ id: "i1", is_candidate: false, status: "firing" }],
});
const suppressed = alert({
  fingerprint: "suppressed",
  status: Status.Suppressed,
});
const onOpen = jest.fn();
const onClear = jest.fn();

beforeEach(() => jest.clearAllMocks());

describe("SelectionStrip", () => {
  it("counts the selection", () => {
    render(
      <SelectionStrip alerts={[a, b, c, d]} onOpen={onOpen} onClear={onClear} />
    );
    expect(screen.getByText("4 selected")).toBeInTheDocument();
  });

  it("uses the plain labels when every ticked alert goes in, then Clear", () => {
    render(
      <SelectionStrip alerts={[a, b]} onOpen={onOpen} onClear={onClear} />
    );
    expect(
      screen
        .getAllByRole("button")
        .map((el) => [
          el.textContent,
          el.getAttribute("type"),
          el.getAttribute("data-cy"),
        ])
    ).toEqual([
      ["Change Status", "button", "widget-selection-action-change-status"],
      ["Link to incident", "button", "widget-selection-action-link-incident"],
      ["Dismiss", "button", "widget-selection-action-dismiss"],
      ["Clear", "button", "widget-selection-clear"],
    ]);
  });

  it("says how many go in when some are skipped, and opens with only those", () => {
    render(
      <SelectionStrip
        alerts={[noInc1, suppressed, noInc2, noInc3]}
        onOpen={onOpen}
        onClear={onClear}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss 3" }));
    expect(onOpen).toHaveBeenCalledWith(
      "dismiss",
      [noInc1, noInc2, noInc3],
      null
    );
  });

  it("links every ticked alert, including those already in an incident", () => {
    render(
      <SelectionStrip
        alerts={[noInc1, inIncident, noInc2, noInc3]}
        onOpen={onOpen}
        onClear={onClear}
      />
    );
    expect(screen.queryByRole("button", { name: /^Link \d/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Link to incident" }));
    expect(onOpen).toHaveBeenCalledWith(
      "link-incident",
      [noInc1, inIncident, noInc2, noInc3],
      null
    );
  });

  it("hands over the button a mouse pressed", () => {
    render(
      <SelectionStrip alerts={[a, b]} onOpen={onOpen} onClear={onClear} />
    );
    const button = screen.getByRole("button", { name: "Dismiss" });

    fireEvent.click(button, { detail: 1 });

    expect(onOpen).toHaveBeenCalledWith("dismiss", [a, b], button);
  });

  it("hides an action no ticked alert qualifies for", () => {
    render(
      <SelectionStrip alerts={[suppressed]} onOpen={onOpen} onClear={onClear} />
    );
    expect(screen.queryByRole("button", { name: /Dismiss/ })).toBeNull();
  });

  it("clears", () => {
    render(<SelectionStrip alerts={[a]} onOpen={onOpen} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
