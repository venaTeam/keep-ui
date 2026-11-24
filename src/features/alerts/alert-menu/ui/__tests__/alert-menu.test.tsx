import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { AlertMenu } from "@/features/alerts/alert-menu/ui/alert-menu";
import { AlertDto, Severity, Status } from "@/entities/alerts/model/types";

jest.mock("@/entities/alerts/model", () =>
  jest.requireActual("@/entities/alerts/model")
);
jest.mock("@/entities/alerts/model/useAlerts", () => ({
  useAlerts: () => ({ alertsMutator: jest.fn() }),
}));
jest.mock("@/utils/hooks/useProviders", () => ({
  useProviders: () => ({ data: { installed_providers: [] } }),
}));
jest.mock(
  "@/entities/workflow-executions/model/useWorkflowExecutions",
  () => ({ useWorkflowExecutions: () => ({ data: [] }) })
);
jest.mock("react-icons/tb", () => jest.requireActual("react-icons/tb"));

const TICKET_BUTTON = '[data-cy="alerts-action-assign-ticket-btn"]';

const alertWithTicket = (ticketUrl: unknown) =>
  ({
    id: "a1",
    event_id: "e1",
    fingerprint: "fp-1",
    name: "disk-full",
    status: Status.Firing,
    severity: Severity.Warning,
    lastReceived: new Date("2026-10-01T10:00:00Z"),
    environment: "prod",
    source: ["prometheus"],
    pushed: true,
    deleted: false,
    ticket_url: ticketUrl,
    enriched_fields: [],
  }) as unknown as AlertDto;

const clickTicket = (ticketUrl: unknown) => {
  const alert = alertWithTicket(ticketUrl);
  const setTicketModalAlert = jest.fn();
  const { container } = render(
    <AlertMenu
      alert={alert}
      presetName="feed"
      setTicketModalAlert={setTicketModalAlert}
    />
  );
  fireEvent.click(container.querySelector(TICKET_BUTTON)!);
  return { alert, setTicketModalAlert };
};

describe("AlertMenu ticket button", () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it.each(["https://tickets.example.com/1", "HTTP://tickets.example.com/1"])(
    "opens the http ticket link %s",
    (ticketUrl) => {
      const { setTicketModalAlert } = clickTicket(ticketUrl);

      expect(openSpy).toHaveBeenCalledWith(ticketUrl, "_blank");
      expect(setTicketModalAlert).not.toHaveBeenCalled();
    }
  );

  it.each([
    "javascript:alert(document.domain)",
    " JavaScript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//evil.example.com/1",
    "/relative/ticket",
    "TICKET-1",
    "",
    undefined,
    null,
    { href: "https://tickets.example.com/1" },
  ])("shows the assign-ticket modal instead of opening %p", (ticketUrl) => {
    const { alert, setTicketModalAlert } = clickTicket(ticketUrl);

    expect(openSpy).not.toHaveBeenCalled();
    expect(setTicketModalAlert).toHaveBeenCalledWith(alert);
  });
});
