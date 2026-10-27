import { IncidentDto } from "@/entities/incidents/model";
import { stringToValue } from "@/features/filter/store/utils";
import {
  DEFAULT_INCIDENT_TABLE_CONFIG,
  INCIDENT_TABLE_COLUMNS,
  INCIDENT_TABLE_LIMIT_MAX,
  INCIDENT_TABLE_LIMIT_MIN,
  INCIDENT_TABLE_NEW_WIDGET_LAYOUT,
  INCIDENT_TABLE_SEVERITY_OPTIONS,
  INCIDENT_TABLE_STATUS_OPTIONS,
  buildIncidentTableCel,
  buildIncidentsPageUrl,
  describeIncidentTableFilters,
  getIncidentTicketLink,
  normalizeIncidentTableConfig,
  orderIncidentTableColumns,
  toPlainText,
  toUtcTimestamp,
  validateIncidentTableConfig,
} from "../incident-table-config";

const inc = (partial: Partial<IncidentDto>) =>
  partial as unknown as IncidentDto;

describe("incident table defaults", () => {
  it("offers statuses, severities and columns in the fixed order", () => {
    expect(INCIDENT_TABLE_STATUS_OPTIONS).toEqual([
      { value: "firing", label: "Firing" },
      { value: "acknowledged", label: "Acknowledged" },
      { value: "suppressed", label: "Suppressed" },
    ]);
    expect(INCIDENT_TABLE_SEVERITY_OPTIONS).toEqual([
      { value: "critical", label: "Critical", order: 5 },
      { value: "high", label: "High", order: 4 },
      { value: "warning", label: "Warning", order: 3 },
    ]);
    expect(INCIDENT_TABLE_COLUMNS).toEqual([
      { id: "status", header: "Status" },
      { id: "severity", header: "Severity" },
      { id: "name", header: "Name" },
      { id: "description", header: "Description" },
      { id: "alertsCount", header: "Alerts" },
      { id: "creationTime", header: "Created" },
      { id: "snLink", header: "SN Link" },
    ]);
  });

  it("selects everything with a limit of 10 by default", () => {
    expect(DEFAULT_INCIDENT_TABLE_CONFIG).toEqual({
      statuses: ["firing", "acknowledged", "suppressed"],
      severities: ["critical", "high", "warning"],
      columns: [
        "status",
        "severity",
        "name",
        "description",
        "alertsCount",
        "creationTime",
        "snLink",
      ],
      limit: 10,
    });
    expect(INCIDENT_TABLE_LIMIT_MIN).toBe(1);
    expect(INCIDENT_TABLE_LIMIT_MAX).toBe(50);
  });

  it("lays a new widget out at 16 by 11", () => {
    expect(INCIDENT_TABLE_NEW_WIDGET_LAYOUT).toEqual({
      w: 16,
      h: 11,
      minW: 0,
      minH: 2,
      static: false,
    });
  });
});

describe("buildIncidentTableCel", () => {
  it("quotes statuses and severity numbers the way the Incidents page facets do", () => {
    expect(buildIncidentTableCel(DEFAULT_INCIDENT_TABLE_CONFIG)).toBe(
      "is_candidate == false && status in ['firing', 'acknowledged', 'suppressed'] && severity in ['5', '4', '3']"
    );
  });

  it("uses the same severity tokens in the CEL and in the page URL", () => {
    const cel = buildIncidentTableCel(DEFAULT_INCIDENT_TABLE_CONFIG);
    const celTokens = /severity in \[(.*)\]$/.exec(cel)?.[1].split(", ");
    const url = new URL(
      buildIncidentsPageUrl(DEFAULT_INCIDENT_TABLE_CONFIG),
      "http://x"
    );
    expect(celTokens).toEqual(
      url.searchParams.get("facet_severity")?.split(",")
    );
  });

  it("builds a CEL for a narrowed selection", () => {
    expect(
      buildIncidentTableCel({
        ...DEFAULT_INCIDENT_TABLE_CONFIG,
        statuses: ["suppressed"],
        severities: ["high"],
      })
    ).toBe(
      "is_candidate == false && status in ['suppressed'] && severity in ['4']"
    );
  });

  it("follows the option order rather than the selection order", () => {
    expect(
      buildIncidentTableCel({
        ...DEFAULT_INCIDENT_TABLE_CONFIG,
        statuses: ["suppressed", "firing"],
        severities: ["warning", "critical"],
      })
    ).toBe(
      "is_candidate == false && status in ['firing', 'suppressed'] && severity in ['5', '3']"
    );
  });
});

describe("buildIncidentsPageUrl", () => {
  it("carries the status and severity facets to the incidents page", () => {
    const url = new URL(
      buildIncidentsPageUrl({
        ...DEFAULT_INCIDENT_TABLE_CONFIG,
        statuses: ["firing", "acknowledged"],
        severities: ["critical"],
      }),
      "http://x"
    );
    expect(url.pathname).toBe("/incidents");
    expect(url.searchParams.get("facet_status")).toBe(
      "'firing','acknowledged'"
    );
    expect(url.searchParams.get("facet_severity")).toBe("'5'");
    expect([...url.searchParams.keys()].sort()).toEqual([
      "facet_severity",
      "facet_status",
    ]);
  });
});

describe("buildIncidentsPageUrl severity tokens", () => {
  it("encodes severities as the quoted string tokens the severity facet options use", () => {
    const url = new URL(
      buildIncidentsPageUrl(DEFAULT_INCIDENT_TABLE_CONFIG),
      "http://x"
    );
    const tokens = (url.searchParams.get("facet_severity") ?? "").split(",");
    expect(tokens).toEqual(["'5'", "'4'", "'3'"]);
    tokens.forEach((token) => {
      expect(typeof stringToValue(token)).toBe("string");
    });
  });
});

describe("validateIncidentTableConfig", () => {
  it("accepts the defaults", () => {
    expect(validateIncidentTableConfig(DEFAULT_INCIDENT_TABLE_CONFIG)).toEqual(
      {}
    );
  });

  it("reports every empty selection and an invalid limit", () => {
    expect(
      validateIncidentTableConfig({
        ...DEFAULT_INCIDENT_TABLE_CONFIG,
        statuses: [],
        severities: [],
        columns: [],
        limit: 0,
      })
    ).toEqual({
      statuses: "Select at least one status",
      severities: "Select at least one severity",
      columns: "Select at least one column",
      limit: "Enter a whole number from 1 to 50",
    });
  });

  it("rejects a limit above the maximum", () => {
    expect(
      validateIncidentTableConfig({
        ...DEFAULT_INCIDENT_TABLE_CONFIG,
        limit: 51,
      }).limit
    ).toBeDefined();
  });

  it("rejects a fractional limit", () => {
    expect(
      validateIncidentTableConfig({
        ...DEFAULT_INCIDENT_TABLE_CONFIG,
        limit: 2.5,
      }).limit
    ).toBeDefined();
  });

  it("accepts the limit bounds", () => {
    expect(
      validateIncidentTableConfig({
        ...DEFAULT_INCIDENT_TABLE_CONFIG,
        limit: 1,
      })
    ).toEqual({});
    expect(
      validateIncidentTableConfig({
        ...DEFAULT_INCIDENT_TABLE_CONFIG,
        limit: 50,
      })
    ).toEqual({});
  });

  it("rejects a non-numeric limit", () => {
    expect(
      validateIncidentTableConfig({
        ...DEFAULT_INCIDENT_TABLE_CONFIG,
        limit: Number.NaN,
      }).limit
    ).toBeDefined();
  });
});

describe("orderIncidentTableColumns", () => {
  it("returns the columns in the fixed order", () => {
    expect(orderIncidentTableColumns(["snLink", "name", "status"])).toEqual([
      "status",
      "name",
      "snLink",
    ]);
  });
});

describe("getIncidentTicketLink", () => {
  it("reads the ServiceNow url and id from enrichments", () => {
    expect(
      getIncidentTicketLink(
        inc({
          enrichments: {
            servicenow_ticket_url: "https://sn/1",
            servicenow_ticket_id: "INC001",
          },
        })
      )
    ).toEqual({ url: "https://sn/1", label: "INC001" });
  });

  it("labels the link Open when there is no ticket id", () => {
    expect(
      getIncidentTicketLink(
        inc({ enrichments: { servicenow_ticket_url: "https://sn/1" } })
      )
    ).toEqual({ url: "https://sn/1", label: "Open" });
  });

  it("falls back to the generic ticketing url", () => {
    expect(
      getIncidentTicketLink(
        inc({
          enrichments: {
            ticketing_ticket_url: "https://t/2",
            ticketing_ticket_id: "T2",
          },
        })
      )
    ).toEqual({ url: "https://t/2", label: "T2" });
  });

  it("prefers the ServiceNow url over the generic ticketing url", () => {
    expect(
      getIncidentTicketLink(
        inc({
          enrichments: {
            servicenow_ticket_url: "https://sn/1",
            ticketing_ticket_url: "https://t/2",
            ticketing_ticket_id: "T2",
          },
        })
      )
    ).toEqual({ url: "https://sn/1", label: "Open" });
  });

  it("skips an empty ServiceNow url", () => {
    expect(
      getIncidentTicketLink(
        inc({
          enrichments: {
            servicenow_ticket_url: "",
            ticketing_ticket_url: "https://t/2",
          },
        })
      )
    ).toEqual({ url: "https://t/2", label: "Open" });
  });

  it("reads a top-level url when the enrichment is absent", () => {
    expect(
      getIncidentTicketLink(
        inc({
          servicenow_ticket_url: "https://sn/top",
        } as unknown as IncidentDto)
      )
    ).toEqual({ url: "https://sn/top", label: "Open" });
  });

  it("falls through an empty enrichment to the top-level url", () => {
    expect(
      getIncidentTicketLink(
        inc({
          enrichments: { servicenow_ticket_url: "" },
          servicenow_ticket_url: "https://sn/top",
        } as unknown as IncidentDto)
      )
    ).toEqual({ url: "https://sn/top", label: "Open" });
  });

  it("uses a numeric ticket id as the label", () => {
    expect(
      getIncidentTicketLink(
        inc({
          enrichments: {
            servicenow_ticket_url: "https://sn/1",
            servicenow_ticket_id: 42,
          },
        })
      )
    ).toEqual({ url: "https://sn/1", label: "42" });
  });

  it("skips a non-http ServiceNow url and uses the generic ticketing url", () => {
    expect(
      getIncidentTicketLink(
        inc({
          enrichments: {
            servicenow_ticket_url: "javascript:alert(1)",
            ticketing_ticket_url: "https://t/2",
            ticketing_ticket_id: "T2",
          },
        })
      )
    ).toEqual({ url: "https://t/2", label: "T2" });
  });

  it("returns null when every candidate url is not http(s)", () => {
    expect(
      getIncidentTicketLink(
        inc({
          enrichments: {
            servicenow_ticket_url: "javascript:alert(1)",
            ticketing_ticket_url: "ftp://t/2",
          },
        })
      )
    ).toBeNull();
  });

  it("trims the url", () => {
    expect(
      getIncidentTicketLink(
        inc({ enrichments: { servicenow_ticket_url: "  https://sn/1  " } })
      )
    ).toEqual({ url: "https://sn/1", label: "Open" });
  });

  it("accepts an upper-case scheme", () => {
    expect(
      getIncidentTicketLink(
        inc({ enrichments: { servicenow_ticket_url: "HTTPS://sn/1" } })
      )
    ).toEqual({ url: "HTTPS://sn/1", label: "Open" });
  });

  it("returns null when no ticket is linked", () => {
    expect(getIncidentTicketLink(inc({ enrichments: {} }))).toBeNull();
    expect(getIncidentTicketLink(inc({}))).toBeNull();
  });
});

describe("toUtcTimestamp", () => {
  it("marks a timezone-less gateway timestamp as UTC", () => {
    expect(toUtcTimestamp("2026-10-27T16:30:47.243739")).toBe(
      "2026-10-27T16:30:47.243739Z"
    );
  });

  it("leaves a Z timestamp unchanged", () => {
    expect(toUtcTimestamp("2026-10-27T16:30:47Z")).toBe("2026-10-27T16:30:47Z");
  });

  it("leaves a timestamp with a colon offset unchanged", () => {
    expect(toUtcTimestamp("2026-10-27T16:30:47+03:00")).toBe(
      "2026-10-27T16:30:47+03:00"
    );
    expect(toUtcTimestamp("2026-10-27T16:30:47-05:30")).toBe(
      "2026-10-27T16:30:47-05:30"
    );
  });

  it("leaves a timestamp with a compact offset unchanged", () => {
    expect(toUtcTimestamp("2026-10-27T16:30:47+0300")).toBe(
      "2026-10-27T16:30:47+0300"
    );
  });

  it("serialises a Date as an ISO string", () => {
    expect(toUtcTimestamp(new Date("2026-10-27T16:30:47.000Z"))).toBe(
      "2026-10-27T16:30:47.000Z"
    );
  });
});

describe("normalizeIncidentTableConfig", () => {
  it("returns the defaults for a missing or non-object value", () => {
    expect(normalizeIncidentTableConfig(undefined)).toEqual(
      DEFAULT_INCIDENT_TABLE_CONFIG
    );
    expect(normalizeIncidentTableConfig(null)).toEqual(
      DEFAULT_INCIDENT_TABLE_CONFIG
    );
    expect(normalizeIncidentTableConfig("firing")).toEqual(
      DEFAULT_INCIDENT_TABLE_CONFIG
    );
    expect(normalizeIncidentTableConfig([])).toEqual(
      DEFAULT_INCIDENT_TABLE_CONFIG
    );
  });

  it("keeps a complete valid config", () => {
    const config = {
      statuses: ["suppressed" as const],
      severities: ["critical" as const],
      columns: ["name" as const],
      limit: 5,
    };
    expect(normalizeIncidentTableConfig(config)).toEqual(config);
  });

  it("fills the fields a partial config is missing", () => {
    expect(normalizeIncidentTableConfig({ statuses: ["firing"] })).toEqual({
      ...DEFAULT_INCIDENT_TABLE_CONFIG,
      statuses: ["firing"],
    });
  });

  it("uses the default for a field of the wrong type", () => {
    expect(
      normalizeIncidentTableConfig({
        statuses: "firing",
        severities: { critical: true },
        columns: 3,
        limit: "5",
      })
    ).toEqual(DEFAULT_INCIDENT_TABLE_CONFIG);
  });

  it("drops unknown values from the lists", () => {
    expect(
      normalizeIncidentTableConfig({
        statuses: ["firing", "resolved", 7],
        severities: ["low", "high"],
        columns: ["name", "bogus", "status"],
      })
    ).toEqual({
      ...DEFAULT_INCIDENT_TABLE_CONFIG,
      statuses: ["firing"],
      severities: ["high"],
      columns: ["status", "name"],
    });
  });

  it("uses the default for a list that is empty after filtering", () => {
    expect(
      normalizeIncidentTableConfig({
        statuses: [],
        severities: ["low"],
        columns: ["bogus"],
      })
    ).toEqual(DEFAULT_INCIDENT_TABLE_CONFIG);
  });

  it("uses the default limit when it is not a whole number from 1 to 50", () => {
    for (const limit of [0, 51, -3, 2.5, NaN, null, "7"]) {
      expect(normalizeIncidentTableConfig({ limit }).limit).toBe(
        DEFAULT_INCIDENT_TABLE_CONFIG.limit
      );
    }
    expect(normalizeIncidentTableConfig({ limit: 1 }).limit).toBe(1);
    expect(normalizeIncidentTableConfig({ limit: 50 }).limit).toBe(50);
  });

  it("does not hand out the default arrays", () => {
    const normalized = normalizeIncidentTableConfig(undefined);
    expect(normalized.statuses).not.toBe(
      DEFAULT_INCIDENT_TABLE_CONFIG.statuses
    );
    expect(normalized.columns).not.toBe(DEFAULT_INCIDENT_TABLE_CONFIG.columns);
  });
});

describe("toPlainText", () => {
  it("strips markup, scripts and entities", () => {
    expect(toPlainText("<p>a &amp; b</p><script>x</script>")).toBe("a & b");
  });

  it("drops style blocks and collapses whitespace", () => {
    expect(toPlainText("<style>p{color:red}</style><p>a\n\n  b</p>")).toBe(
      "a b"
    );
  });

  it("separates words across paragraph boundaries", () => {
    expect(toPlainText("<p>a</p><p>b</p>")).toBe("a b");
  });

  it("separates words across line breaks", () => {
    expect(toPlainText("a<br>b")).toBe("a b");
  });

  it("keeps inline markup inside a word together", () => {
    expect(toPlainText("<b>wo</b>rd")).toBe("word");
  });

  it("falls back to stripping tags when DOMParser is unavailable", () => {
    const original = window.DOMParser;
    (window as unknown as { DOMParser?: unknown }).DOMParser = undefined;
    try {
      expect(toPlainText("<p>a</p><p>b</p>")).toBe("a b");
    } finally {
      window.DOMParser = original;
    }
  });

  it("returns an empty string for missing input", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText(undefined)).toBe("");
    expect(toPlainText("")).toBe("");
  });
});

describe("describeIncidentTableFilters", () => {
  it("lists statuses then severities in option order", () => {
    expect(
      describeIncidentTableFilters({
        ...DEFAULT_INCIDENT_TABLE_CONFIG,
        severities: ["high", "critical"],
      })
    ).toBe("Firing, Acknowledged, Suppressed · Critical, High");
  });
});
