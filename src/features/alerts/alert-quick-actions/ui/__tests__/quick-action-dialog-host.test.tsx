import { render, screen } from "@testing-library/react";
import { AlertDto, Status } from "@/entities/alerts/model/types";
import { QuickActionDialogHost } from "../quick-action-dialog-host";

const mockChangeStatusDialog = jest.fn();
const mockLinkIncidentDialog = jest.fn();
const mockDismissDialog = jest.fn();

jest.mock("../action-dialogs", () => ({
  ChangeStatusDialog: (props: unknown) => {
    mockChangeStatusDialog(props);
    return <div data-testid="ChangeStatusDialog" />;
  },
  LinkIncidentDialog: (props: unknown) => {
    mockLinkIncidentDialog(props);
    return <div data-testid="LinkIncidentDialog" />;
  },
  DismissDialog: (props: unknown) => {
    mockDismissDialog(props);
    return <div data-testid="DismissDialog" />;
  },
}));

const a = {
  id: "a",
  fingerprint: "fp",
  name: "disk-full",
  status: Status.Firing,
  lastReceived: "2026-11-16T10:00:00Z",
  source: ["prometheus"],
} as unknown as AlertDto;
const close = jest.fn();
const ok = jest.fn();

beforeEach(() => jest.clearAllMocks());

describe("QuickActionDialogHost", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <QuickActionDialogHost
        open={null}
        presetName="feed"
        onClose={close}
        onSuccess={ok}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the open action's dialog with its alerts and callbacks", () => {
    render(
      <QuickActionDialogHost
        open={{ actionId: "dismiss", alerts: [a] }}
        presetName="feed"
        onClose={close}
        onSuccess={ok}
      />
    );
    expect(screen.getByTestId("DismissDialog")).toBeInTheDocument();
    expect(mockDismissDialog.mock.lastCall![0]).toEqual(
      expect.objectContaining({
        alerts: [a],
        presetName: "feed",
        onClose: close,
        onSuccess: ok,
      })
    );
    expect(mockChangeStatusDialog).not.toHaveBeenCalled();
    expect(mockLinkIncidentDialog).not.toHaveBeenCalled();
  });

  it("renders nothing for an unknown action id", () => {
    const { container } = render(
      <QuickActionDialogHost
        open={{ actionId: "nope", alerts: [a] }}
        presetName="feed"
        onClose={close}
        onSuccess={ok}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the action has no alerts", () => {
    const { container } = render(
      <QuickActionDialogHost
        open={{ actionId: "change-status", alerts: [] }}
        presetName="feed"
        onClose={close}
        onSuccess={ok}
      />
    );
    expect(container).toBeEmptyDOMElement();
    expect(mockChangeStatusDialog).not.toHaveBeenCalled();
  });
});
