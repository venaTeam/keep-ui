import { render } from "@testing-library/react";
import { AlertDto, Status } from "@/entities/alerts/model/types";
import { ALERT_QUICK_ACTIONS, getQuickAction } from "../actions";
import {
  ChangeStatusDialog,
  DismissDialog,
  LinkIncidentDialog,
} from "../../ui/action-dialogs";

const mockChangeStatus = jest.fn();
const mockDismiss = jest.fn();
const mockAssociate = jest.fn();

jest.mock("@/features/alerts/alert-change-status", () => ({
  AlertChangeStatusModal: (props: unknown) => {
    mockChangeStatus(props);
    return null;
  },
}));

jest.mock("@/features/alerts/dismiss-alert", () => ({
  AlertDismissModal: (props: unknown) => {
    mockDismiss(props);
    return null;
  },
}));

jest.mock("@/features/alerts/alert-associate-to-incident", () => ({
  AlertAssociateIncidentModal: (props: unknown) => {
    mockAssociate(props);
    return null;
  },
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

const a1 = alert({ id: "a1", fingerprint: "fp1" });
const a2 = alert({ id: "a2", fingerprint: "fp2" });
const close = jest.fn();
const ok = jest.fn();

beforeEach(() => jest.clearAllMocks());

describe("ALERT_QUICK_ACTIONS", () => {
  it("lists the actions in screen order", () =>
    expect(ALERT_QUICK_ACTIONS.map((a) => a.id)).toEqual([
      "change-status",
      "link-incident",
      "dismiss",
    ]));

  it("uses the exact labels and partial labels", () =>
    expect(
      ALERT_QUICK_ACTIONS.map((a) => [a.label, a.partialLabel(3), a.bulk])
    ).toEqual([
      ["Change Status", "Change Status", true],
      ["Link to incident", "Link to incident", true],
      ["Dismiss", "Dismiss 3", true],
    ]));

  it("returns undefined for an unknown id", () =>
    expect(getQuickAction("nope")).toBeUndefined());

  it("offers Change Status for every alert", () =>
    expect(
      getQuickAction("change-status")!.appliesTo(
        alert({ status: Status.Suppressed })
      )
    ).toBe(true));

  it("offers Link for every alert, even one already in a live incident", () => {
    const link = getQuickAction("link-incident")!;
    expect(link.appliesTo(alert({}))).toBe(true);
    expect(
      link.appliesTo(
        alert({
          incident_dto: [{ id: "i", is_candidate: false, status: "firing" }],
        })
      )
    ).toBe(true);
  });

  it("hides Dismiss for suppressed alerts", () => {
    const dismiss = getQuickAction("dismiss")!;
    expect(dismiss.appliesTo(alert({}))).toBe(true);
    expect(dismiss.appliesTo(alert({ status: Status.Suppressed }))).toBe(false);
  });

  it("wires each action to its dialog adapter", () =>
    expect(ALERT_QUICK_ACTIONS.map((a) => a.Dialog)).toEqual([
      ChangeStatusDialog,
      LinkIncidentDialog,
      DismissDialog,
    ]));
});

describe("dialog adapters", () => {
  it("opens Change Status with the single alert, not an array", () => {
    render(
      <ChangeStatusDialog
        alerts={[a1]}
        presetName="feed"
        onClose={close}
        onSuccess={ok}
      />
    );
    expect(mockChangeStatus.mock.lastCall![0]).toEqual(
      expect.objectContaining({
        alert: a1,
        presetName: "feed",
        handleClose: close,
        onSuccess: ok,
      })
    );
  });

  it("opens Change Status in batch mode for several alerts", () => {
    render(
      <ChangeStatusDialog
        alerts={[a1, a2]}
        presetName="feed"
        onClose={close}
        onSuccess={ok}
      />
    );
    expect(mockChangeStatus.mock.lastCall![0].alert).toEqual([a1, a2]);
  });

  it("opens Dismiss with an array and the preset", () => {
    render(
      <DismissDialog
        alerts={[a1]}
        presetName="feed"
        onClose={close}
        onSuccess={ok}
      />
    );
    expect(mockDismiss.mock.lastCall![0]).toEqual(
      expect.objectContaining({
        alert: [a1],
        preset: "feed",
        handleClose: close,
        onSuccess: ok,
      })
    );
  });

  it("opens Associate already open, with success wired to handleSuccess", () => {
    render(
      <LinkIncidentDialog
        alerts={[a1, a2]}
        presetName="feed"
        onClose={close}
        onSuccess={ok}
      />
    );
    expect(mockAssociate.mock.lastCall![0]).toEqual(
      expect.objectContaining({
        isOpen: true,
        alerts: [a1, a2],
        handleSuccess: ok,
        handleClose: close,
      })
    );
  });
});
