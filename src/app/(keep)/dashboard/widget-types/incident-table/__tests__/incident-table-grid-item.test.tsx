import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { IncidentDto } from "@/entities/incidents/model";
import {
  IncidentTableWidgetConfig,
  WidgetData,
  WidgetType,
} from "../../../types";
import {
  DEFAULT_INCIDENT_TABLE_CONFIG,
  INCIDENT_TABLE_COLUMNS,
  buildIncidentTableCel,
  buildIncidentsPageUrl,
} from "../incident-table-config";
import IncidentTableGridItem from "../incident-table-grid-item";
import { useIncidents } from "@/utils/hooks/useIncidents";

const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/utils/hooks/useIncidents", () => ({
  useIncidents: jest.fn(),
}));

jest.mock("react-timeago", () => ({
  __esModule: true,
  default: ({ date, title }: { date: unknown; title?: string }) =>
    require("react").createElement(
      "time",
      { "data-testid": "time-ago", "data-date": String(date), title },
      "ago"
    ),
}));

const mockUseIncidents = useIncidents as unknown as jest.Mock;

const i1 = {
  id: "i1",
  status: "firing",
  severity: "critical",
  user_generated_name: "Payments down",
  user_summary: "<p>5xx &amp; timeouts</p>",
  alerts_count: 14,
  creation_time: "2026-10-27T08:00:00Z",
  enrichments: {
    servicenow_ticket_url: "https://sn/1",
    servicenow_ticket_id: "INC001",
  },
} as unknown as IncidentDto;

const i2 = {
  id: "i2",
  status: "suppressed",
  severity: "high",
  ai_generated_name: "Disk full",
  alerts_count: 3,
  creation_time: "2026-10-27T09:00:00Z",
  enrichments: {},
} as unknown as IncidentDto;

function setIncidents(
  result: Partial<{ data: unknown; isLoading: boolean; error: unknown }> = {}
) {
  mockUseIncidents.mockReturnValue({
    data: { count: 2, limit: 10, offset: 0, items: [i1, i2] },
    isLoading: false,
    error: undefined,
    ...result,
  });
}

function renderTable(config: Partial<IncidentTableWidgetConfig> = {}) {
  const cfg = { ...DEFAULT_INCIDENT_TABLE_CONFIG, ...config };
  const item = {
    i: "w1",
    name: "Incident Table",
    widgetType: WidgetType.INCIDENT_TABLE,
    incidentTable: cfg,
  } as unknown as WidgetData;
  render(<IncidentTableGridItem item={item} />);
  return cfg;
}

const dataRows = () => screen.getAllByRole("row").slice(1);

const LINK_BTN_SELECTOR =
  '[data-cy="dashboard-widget-incident-table-link-btn"]';
const RUNBOOK_LINK = { url: "https://wiki/runbook", label: "Runbook" };

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  setIncidents();
});

describe("IncidentTableGridItem", () => {
  it("queries incidents with the widget CEL, newest first, limit and 30s refresh", () => {
    const cfg = renderTable({ limit: 7 });

    expect(mockUseIncidents).toHaveBeenCalledWith(
      expect.objectContaining({
        cel: buildIncidentTableCel(cfg),
        limit: 7,
        offset: 0,
        sorting: { id: "creation_time", desc: true },
      }),
      expect.objectContaining({ refreshInterval: 30000 })
    );
  });

  it("falls back to the default config when the widget has none", () => {
    const item = {
      i: "w1",
      name: "Incident Table",
      widgetType: WidgetType.INCIDENT_TABLE,
    } as unknown as WidgetData;
    render(<IncidentTableGridItem item={item} />);

    expect(mockUseIncidents).toHaveBeenCalledWith(
      expect.objectContaining({
        cel: buildIncidentTableCel(DEFAULT_INCIDENT_TABLE_CONFIG),
        limit: DEFAULT_INCIDENT_TABLE_CONFIG.limit,
      }),
      expect.anything()
    );
  });

  it("ignores the dashboard time filter", () => {
    mockSearchParams = new URLSearchParams({
      time_stamp: JSON.stringify({ start: "2026-01-01", end: "2026-01-02" }),
    });
    const cfg = renderTable();

    expect(mockUseIncidents.mock.calls[0][0].cel).toBe(
      buildIncidentTableCel(cfg)
    );
  });

  it("renders headers in fixed order for out-of-order columns", () => {
    renderTable({ columns: ["snLink", "name", "status"] });

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent)
    ).toEqual(["Status", "Name", "SN Link"]);
  });

  it("renders cell content", () => {
    renderTable();

    expect(screen.getByText("Payments down")).toBeInTheDocument();
    expect(screen.getByText("5xx & timeouts")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("Disk full")).toBeInTheDocument();
    expect(screen.getByText("Firing")).toBeInTheDocument();
    expect(screen.getByText("Suppressed")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "INC001" });
    expect(link).toHaveAttribute("href", "https://sn/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    const [, secondRow] = dataRows();
    expect(within(secondRow).getByText("—")).toBeInTheDocument();
    expect(within(secondRow).queryByRole("link")).toBeNull();
  });

  it("gives names and descriptions a full-text title", () => {
    renderTable();

    expect(screen.getByText("Payments down")).toHaveAttribute(
      "title",
      "Payments down"
    );
    expect(screen.getByText("5xx & timeouts")).toHaveAttribute(
      "title",
      "5xx & timeouts"
    );
  });

  it("falls back to the generated summary when the user summary is empty", () => {
    setIncidents({
      data: {
        count: 1,
        limit: 10,
        offset: 0,
        items: [
          {
            ...i1,
            user_summary: "",
            generated_summary: "<p>Auto <b>generated</b> summary</p>",
          },
        ],
      },
    });
    renderTable();

    const description = screen.getByText("Auto generated summary");
    expect(description).toHaveAttribute("title", "Auto generated summary");
  });

  it("treats a timezone-less creation time as UTC", () => {
    setIncidents({
      data: {
        count: 1,
        limit: 10,
        offset: 0,
        items: [{ ...i1, creation_time: "2026-10-27T16:30:47.243739" }],
      },
    });
    renderTable({ columns: ["creationTime"] });

    const timeAgo = screen.getByTestId("time-ago");
    expect(timeAgo).toHaveAttribute("data-date", "2026-10-27T16:30:47.243739Z");
    expect(timeAgo).toHaveAttribute(
      "title",
      new Date("2026-10-27T16:30:47.243739Z").toLocaleString()
    );
  });

  it("leaves a creation time that already has an offset alone", () => {
    setIncidents({
      data: {
        count: 1,
        limit: 10,
        offset: 0,
        items: [{ ...i1, creation_time: "2026-10-27T16:30:47+03:00" }],
      },
    });
    renderTable({ columns: ["creationTime"] });

    expect(screen.getByTestId("time-ago")).toHaveAttribute(
      "data-date",
      "2026-10-27T16:30:47+03:00"
    );
  });

  it("renders a partial saved config with the default columns", () => {
    const item = {
      i: "w1",
      name: "Incident Table",
      widgetType: WidgetType.INCIDENT_TABLE,
      incidentTable: { statuses: ["firing"] },
    } as unknown as WidgetData;

    expect(() => render(<IncidentTableGridItem item={item} />)).not.toThrow();

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent)
    ).toEqual(INCIDENT_TABLE_COLUMNS.map((column) => column.header));
    expect(mockUseIncidents).toHaveBeenCalledWith(
      expect.objectContaining({
        cel: buildIncidentTableCel({
          ...DEFAULT_INCIDENT_TABLE_CONFIG,
          statuses: ["firing"],
        }),
        limit: DEFAULT_INCIDENT_TABLE_CONFIG.limit,
      }),
      expect.anything()
    );
  });

  it("falls through a non-http ServiceNow url to the generic ticket link", () => {
    setIncidents({
      data: {
        count: 1,
        limit: 10,
        offset: 0,
        items: [
          {
            ...i1,
            enrichments: {
              servicenow_ticket_url: "javascript:alert(1)",
              ticketing_ticket_url: "https://t/2",
              ticketing_ticket_id: "T2",
            },
          },
        ],
      },
    });
    renderTable();

    expect(screen.getByRole("link", { name: "T2" })).toHaveAttribute(
      "href",
      "https://t/2"
    );
  });

  it("shows a dash instead of a link for a non-http ticket url", () => {
    setIncidents({
      data: {
        count: 1,
        limit: 10,
        offset: 0,
        items: [
          {
            ...i1,
            enrichments: {
              servicenow_ticket_url: "javascript:alert(1)",
              servicenow_ticket_id: "INC001",
            },
          },
        ],
      },
    });
    renderTable();

    const [row] = dataRows();
    expect(within(row).getByText("—")).toBeInTheDocument();
    expect(within(row).queryByRole("link")).toBeNull();
    expect(screen.queryByText(/INC001/)).toBeNull();
  });

  it("shows the count and a showing-of line when results are cut off", () => {
    setIncidents({
      data: { count: 23, limit: 2, offset: 0, items: [i1, i2] },
    });
    renderTable({ limit: 2 });

    expect(screen.getByText("Incidents count:")).toBeInTheDocument();
    expect(screen.getByText("showing 2 out of 23")).toBeInTheDocument();
  });

  it("shows the plain count when everything fits", () => {
    renderTable({ limit: 10 });

    expect(
      screen.getByText("Incidents count:").nextElementSibling
    ).toHaveTextContent(/^2$/);
    expect(screen.queryByText(/out of/)).toBeNull();
  });

  it("shows the active filters", () => {
    renderTable();

    expect(
      screen.getByText(
        "Firing, Acknowledged, Suppressed · Critical, High, Warning"
      )
    ).toBeInTheDocument();
  });

  it("Go to INC page navigates to the filtered Incidents page", () => {
    const cfg = renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Go to INC page" }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(buildIncidentsPageUrl(cfg));
  });

  it("shows no extra button when the widget has no external link", () => {
    renderTable();

    expect(document.querySelector(LINK_BTN_SELECTOR)).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("shows the external link button with its label and url as the title", () => {
    renderTable({ externalLink: RUNBOOK_LINK });

    const button = screen.getByRole("button", { name: "Runbook" });
    expect(button).toHaveAttribute("title", "https://wiki/runbook");
    expect(document.querySelector(LINK_BTN_SELECTOR)).toBe(button);
  });

  it("styles the external link button blue and leaves Go to INC page orange", () => {
    renderTable({ externalLink: RUNBOOK_LINK });

    const linkButton = screen.getByRole("button", { name: "Runbook" });
    const goButton = screen.getByRole("button", { name: "Go to INC page" });
    expect(linkButton.className).toMatch(/blue/);
    expect(linkButton.className).not.toMatch(/orange/);
    expect(goButton.className).toMatch(/orange/);
    expect(goButton.className).not.toMatch(/blue/);
  });

  it("places the external link button before Go to INC page", () => {
    renderTable({ externalLink: RUNBOOK_LINK });

    const linkButton = screen.getByRole("button", { name: "Runbook" });
    const goButton = screen.getByRole("button", { name: "Go to INC page" });
    expect(linkButton.parentElement).toBe(goButton.parentElement);
    expect(
      linkButton.compareDocumentPosition(goButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("opens the external link in a new tab without navigating", () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    try {
      renderTable({ externalLink: RUNBOOK_LINK });

      fireEvent.click(screen.getByRole("button", { name: "Runbook" }));

      expect(open).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledWith(
        "https://wiki/runbook",
        "_blank",
        "noopener,noreferrer"
      );
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      open.mockRestore();
    }
  });

  it("Go to INC page still navigates when an external link is set", () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    try {
      const cfg = renderTable({ externalLink: RUNBOOK_LINK });

      fireEvent.click(screen.getByRole("button", { name: "Go to INC page" }));

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(buildIncidentsPageUrl(cfg));
      expect(open).not.toHaveBeenCalled();
    } finally {
      open.mockRestore();
    }
  });

  it("uses the trimmed url and label of a saved external link", () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    try {
      renderTable({
        externalLink: { url: "  https://wiki/runbook ", label: " Runbook  " },
      });

      fireEvent.click(screen.getByRole("button", { name: "Runbook" }));

      expect(open).toHaveBeenCalledWith(
        "https://wiki/runbook",
        "_blank",
        "noopener,noreferrer"
      );
    } finally {
      open.mockRestore();
    }
  });

  it("shows no external link button for a saved link that is not usable", () => {
    const unusable = [
      { url: "javascript:alert(1)", label: "Runbook" },
      { url: "https://wiki/runbook", label: "" },
      { url: "https://wiki/runbook", label: "a".repeat(31) },
    ];
    for (const externalLink of unusable) {
      const { unmount } = render(
        <IncidentTableGridItem
          item={
            {
              i: "w1",
              name: "Incident Table",
              widgetType: WidgetType.INCIDENT_TABLE,
              incidentTable: { ...DEFAULT_INCIDENT_TABLE_CONFIG, externalLink },
            } as unknown as WidgetData
          }
        />
      );

      expect(document.querySelector(LINK_BTN_SELECTOR)).toBeNull();
      expect(screen.getAllByRole("button")).toHaveLength(1);
      unmount();
    }
  });

  it("exposes the e2e selectors", () => {
    renderTable();

    expect(
      document.querySelector('[data-cy="dashboard-widget-incident-table"]')
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-cy="dashboard-widget-incident-table-go-btn"]'
      )
    ).toBeInTheDocument();
  });

  it("row click opens the incident, SN link click does not", () => {
    renderTable();

    fireEvent.click(screen.getByText("Payments down"));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/incidents/i1/alerts");

    mockPush.mockClear();
    fireEvent.click(screen.getByRole("link", { name: "INC001" }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("row click does nothing while text is selected", () => {
    const selection = jest
      .spyOn(window, "getSelection")
      .mockReturnValue({ toString: () => "Payments" } as unknown as Selection);
    try {
      renderTable();

      fireEvent.click(screen.getByText("Payments down"));

      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      selection.mockRestore();
    }
  });

  it("row click opens the incident when the selection is empty", () => {
    const selection = jest
      .spyOn(window, "getSelection")
      .mockReturnValue({ toString: () => "" } as unknown as Selection);
    try {
      renderTable();

      fireEvent.click(screen.getByText("Payments down"));

      expect(mockPush).toHaveBeenCalledWith("/incidents/i1/alerts");
    } finally {
      selection.mockRestore();
    }
  });

  it("row click opens the incident when there is no selection object", () => {
    const selection = jest.spyOn(window, "getSelection").mockReturnValue(null);
    try {
      renderTable();

      fireEvent.click(screen.getByText("Payments down"));

      expect(mockPush).toHaveBeenCalledWith("/incidents/i1/alerts");
    } finally {
      selection.mockRestore();
    }
  });

  it("shows an empty state", () => {
    setIncidents({ data: { count: 0, limit: 10, offset: 0, items: [] } });
    renderTable();

    expect(
      screen.getByText("No incidents match these filters")
    ).toBeInTheDocument();
  });

  it("shows 5 skeleton rows while loading", () => {
    setIncidents({ data: undefined, isLoading: true });
    renderTable();

    expect(screen.getAllByTestId("incident-table-skeleton-row")).toHaveLength(
      5
    );
    expect(screen.queryByText("No incidents match these filters")).toBeNull();
  });

  it("shows an error state", () => {
    setIncidents({ data: undefined, error: new Error() });
    renderTable();

    expect(screen.getByText("Couldn't load incidents")).toBeInTheDocument();
  });

  it("shows the error above the last results when a refresh fails", () => {
    setIncidents({ error: new Error() });
    renderTable();

    const errorLine = screen.getByText("Couldn't load incidents");
    expect(screen.getByText("Payments down")).toBeInTheDocument();
    expect(screen.getByText("Disk full")).toBeInTheDocument();
    expect(
      screen.getByText("Incidents count:").nextElementSibling
    ).toHaveTextContent(/^2$/);
    expect(
      errorLine.compareDocumentPosition(screen.getByRole("table")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      screen
        .getByText("Firing, Acknowledged, Suppressed · Critical, High, Warning")
        .compareDocumentPosition(errorLine) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
