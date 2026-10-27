import { 
  getProviderBaseUrl, 
  getTicketViewUrl, 
  getTicketCreateUrl, 
  findLinkedTicket,
  getTicketEnrichmentKey,
  type LinkedTicket 
} from "../ticketing-utils";
import { type Provider } from "@/shared/api/providers";
import { Status, Severity, type IncidentDto } from "@/entities/incidents/model/models";

// Mock provider data for testing
const mockServiceNowProvider: Provider = {
  id: "servicenow",
  type: "servicenow",
  display_name: "ServiceNow",
  tags: ["ticketing"],
  config: {},
  installed: true,
  linked: true,
  last_alert_received: "",
  details: {
    authentication: {
      service_now_base_url: "https://company.service-now.com",
      ticket_creation_url: "https://company.service-now.com/now/sow/record/incident/-1/params"
    }
  },
  can_query: false,
  can_notify: true,
  validatedScopes: {},
  pulling_available: false,
  pulling_enabled: true,
  categories: ["Ticketing"],
  coming_soon: false,
  health: false,
};

const mockJiraProvider: Provider = {
  id: "jira",
  type: "jira",
  display_name: "Jira",
  tags: ["ticketing"],
  config: {},
  installed: true,
  linked: true,
  last_alert_received: "",
  details: {
    authentication: {
      jira_base_url: "https://company.atlassian.net",
      ticket_creation_url: "https://company.atlassian.net/secure/CreateIssue.jspa"
    }
  },
  can_query: false,
  can_notify: true,
  validatedScopes: {},
  pulling_available: false,
  pulling_enabled: true,
  categories: ["Ticketing"],
  coming_soon: false,
  health: false,
};

const mockZendeskProvider: Provider = {
  id: "zendesk",
  type: "zendesk",
  display_name: "Zendesk",
  tags: ["ticketing"],
  config: {},
  installed: true,
  linked: true,
  last_alert_received: "",
  details: {
    authentication: {
      host: "https://company.zendesk.com",
      ticket_creation_url: "https://company.zendesk.com/agent/filters/new"
    }
  },
  can_query: false,
  can_notify: true,
  validatedScopes: {},
  pulling_available: false,
  pulling_enabled: true,
  categories: ["Ticketing"],
  coming_soon: false,
  health: false,
};

// Mock incident data for testing
const createMockIncident = (enrichments: Record<string, any> = {}): IncidentDto => ({
  id: "test-incident-id",
  user_generated_name: "Test Incident",
  ai_generated_name: "Test Incident",
  user_summary: "Test summary",
  generated_summary: "Test generated summary",
  assignee: "test-assignee",
  status: Status.Firing,
  severity: Severity.High,
  alerts_count: 1,
  alert_sources: ["test-source"],
  services: ["test-service"],
  creation_time: new Date(),
  is_candidate: false,
  rule_fingerprint: "test-fingerprint",
  same_incident_in_the_past_id: "",
  following_incidents_ids: [],
  merged_into_incident_id: "",
  merged_by: "",
  merged_at: new Date(),
  fingerprint: "test-fingerprint",
  enrichments,
  resolve_on: "all_resolved",
});

describe("ticketing-utils", () => {
  describe("getProviderBaseUrl", () => {
    it("should extract ServiceNow base URL", () => {
      const result = getProviderBaseUrl(mockServiceNowProvider);
      expect(result).toBe("https://company.service-now.com");
    });

    it("should extract Jira base URL", () => {
      const result = getProviderBaseUrl(mockJiraProvider);
      expect(result).toBe("https://company.atlassian.net");
    });

    it("should extract Zendesk domain", () => {
      const result = getProviderBaseUrl(mockZendeskProvider);
      expect(result).toBe("https://company.zendesk.com");
    });

    it("should return empty string for provider without authentication", () => {
      const providerWithoutAuth = { ...mockServiceNowProvider, details: { authentication: {} } };
      const result = getProviderBaseUrl(providerWithoutAuth);
      expect(result).toBe("");
    });
  });

  describe("getTicketViewUrl", () => {
    it("should get ticket URL from incident enrichments for ServiceNow", () => {
      const incident = createMockIncident({
        servicenow_ticket_url: "https://company.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3DINC0012345"
      });
      const result = getTicketViewUrl(incident, mockServiceNowProvider);
      expect(result).toBe("https://company.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3DINC0012345");
    });

    it("should get ticket URL from incident enrichments for Jira", () => {
      const incident = createMockIncident({
        jira_ticket_url: "https://company.atlassian.net/browse/PROJ-123"
      });
      const result = getTicketViewUrl(incident, mockJiraProvider);
      expect(result).toBe("https://company.atlassian.net/browse/PROJ-123");
    });

    it("should get ticket URL from incident enrichments for Zendesk", () => {
      const incident = createMockIncident({
        zendesk_ticket_url: "https://company.zendesk.com/agent/tickets/12345"
      });
      const result = getTicketViewUrl(incident, mockZendeskProvider);
      expect(result).toBe("https://company.zendesk.com/agent/tickets/12345");
    });

    it("should return empty string when no ticket URL in enrichments", () => {
      const incident = createMockIncident({});
      const result = getTicketViewUrl(incident, mockServiceNowProvider);
      expect(result).toBe("");
    });

    it("should return empty string when incident has no enrichments", () => {
      const incident = createMockIncident();
      const result = getTicketViewUrl(incident, mockServiceNowProvider);
      expect(result).toBe("");
    });
  });

  describe("getTicketCreateUrl", () => {
    // A ServiceNow URL that already carries a params/query payload, so the
    // pairs are appended to it rather than starting a new one.
    const mockServiceNowWithQueryProvider: Provider = {
      ...mockServiceNowProvider,
      details: {
        authentication: {
          ...mockServiceNowProvider.details.authentication,
          ticket_creation_url:
            "https://company.service-now.com/now/sow/record/incident/-1/params/query/active=true",
        },
      },
    };

    const withUrl = (provider: Provider, ticket_creation_url: string): Provider => ({
      ...provider,
      details: {
        authentication: { ...provider.details.authentication, ticket_creation_url },
      },
    });

    describe("servicenow", () => {
      it("adds params/query when the configured URL has none", () => {
        const result = getTicketCreateUrl(mockServiceNowProvider, "Test description", "Test title");
        expect(result).toBe(
          "https://company.service-now.com/now/sow/record/incident/-1/params?params/query=short_description=Test%20title^description=Test%20description"
        );
      });

      it("appends to the payload when the URL already has params/query", () => {
        const result = getTicketCreateUrl(mockServiceNowWithQueryProvider, "Test description", "Test title");
        expect(result).toBe(
          "https://company.service-now.com/now/sow/record/incident/-1/params/query/active=true^short_description=Test%20title^description=Test%20description"
        );
      });

      it("starts the payload when params/query has nothing after it", () => {
        const provider = withUrl(
          mockServiceNowProvider,
          "https://company.service-now.com/now/sow/record/incident/-1/params/query"
        );
        // Joined with "/" rather than "^": there is no earlier pair to separate from.
        expect(getTicketCreateUrl(provider, "Test description", "Test title")).toBe(
          "https://company.service-now.com/now/sow/record/incident/-1/params/query/short_description=Test%20title^description=Test%20description"
        );
      });

      it("does not double the slash when params/query ends with one", () => {
        const provider = withUrl(
          mockServiceNowProvider,
          "https://company.service-now.com/now/sow/record/incident/-1/params/query/"
        );
        expect(getTicketCreateUrl(provider, "Test description", "Test title")).toBe(
          "https://company.service-now.com/now/sow/record/incident/-1/params/query/short_description=Test%20title^description=Test%20description"
        );
      });

      it("treats params/query only as a trailing segment", () => {
        // The text appears mid-path, so it is not the payload marker.
        const provider = withUrl(
          mockServiceNowProvider,
          "https://company.service-now.com/params/query/x/now/sow/record/incident/-1"
        );
        expect(getTicketCreateUrl(provider, "Test description", "Test title")).toBe(
          "https://company.service-now.com/params/query/x/now/sow/record/incident/-1?params/query=short_description=Test%20title^description=Test%20description"
        );
      });

      it("extends an existing params/query request parameter", () => {
        const provider = withUrl(
          mockServiceNowProvider,
          "https://company.service-now.com/now/sow/record/incident/-1/params?params/query=active=true"
        );
        // Extended in place -- a second params/query would be ignored.
        expect(getTicketCreateUrl(provider, "Test description", "Test title")).toBe(
          "https://company.service-now.com/now/sow/record/incident/-1/params?params/query=active=true^short_description=Test%20title^description=Test%20description"
        );
      });

      it("fills an empty params/query request parameter", () => {
        const provider = withUrl(
          mockServiceNowProvider,
          "https://company.service-now.com/now/sow/record/incident/-1/params?params/query="
        );
        expect(getTicketCreateUrl(provider, "Test description", "Test title")).toBe(
          "https://company.service-now.com/now/sow/record/incident/-1/params?params/query=short_description=Test%20title^description=Test%20description"
        );
      });

      it("leaves the other request parameters alone", () => {
        const provider = withUrl(
          mockServiceNowProvider,
          "https://company.service-now.com/now/sow/record/incident/-1?params/query=active=true&x=1"
        );
        expect(getTicketCreateUrl(provider, "Test description", "Test title")).toBe(
          "https://company.service-now.com/now/sow/record/incident/-1?params/query=active=true^short_description=Test%20title^description=Test%20description&x=1"
        );
      });

      it("keeps a query string out of a path payload", () => {
        const provider = withUrl(
          mockServiceNowProvider,
          "https://company.service-now.com/now/sow/record/incident/-1/params/query/active=true?sysparm_stack=no"
        );
        // ?sysparm_stack=no must not be swallowed into the payload.
        expect(getTicketCreateUrl(provider, "Test description", "Test title")).toBe(
          "https://company.service-now.com/now/sow/record/incident/-1/params/query/active=true^short_description=Test%20title^description=Test%20description?sysparm_stack=no"
        );
      });

      it("keeps a fragment out of a path payload", () => {
        const provider = withUrl(
          mockServiceNowProvider,
          "https://company.service-now.com/now/sow/record/incident/-1/params/query/active=true#frag"
        );
        expect(getTicketCreateUrl(provider, "Test description", "Test title")).toBe(
          "https://company.service-now.com/now/sow/record/incident/-1/params/query/active=true^short_description=Test%20title^description=Test%20description#frag"
        );
      });

      it("uses & when the configured URL already has a query string", () => {
        const provider = withUrl(
          mockServiceNowProvider,
          "https://company.service-now.com/now/sow/record/incident/-1?sysparm_stack=no"
        );
        const result = getTicketCreateUrl(provider, "Test description", "Test title");
        expect(result).toBe(
          "https://company.service-now.com/now/sow/record/incident/-1?sysparm_stack=no&params/query=short_description=Test%20title^description=Test%20description"
        );
      });

      it("encodes characters that would otherwise truncate or split the URL", () => {
        const result = getTicketCreateUrl(
          mockServiceNowProvider,
          "Disk at 90% & climbing",
          "DB #4 down"
        );
        // A raw # drops everything after it; a raw & starts a new parameter.
        expect(result).toContain("short_description=DB%20%234%20down");
        expect(result).toContain("description=Disk%20at%2090%25%20%26%20climbing");
      });

      it("uses the configured ticket creation URL when available", () => {
        const provider = withUrl(mockServiceNowProvider, "https://custom.service-now.com/custom/create");
        const result = getTicketCreateUrl(provider, "Test description", "Test title");
        expect(result).toBe(
          "https://custom.service-now.com/custom/create?params/query=short_description=Test%20title^description=Test%20description"
        );
      });
    });

    describe("jira / zendesk", () => {
      // Unchanged by this change -- see the TODO in getTicketCreateUrl. These
      // pin the existing behaviour so that altering it is a deliberate act,
      // and they assert what this codebase emits, not that either vendor
      // accepts it: neither has been checked against a live instance.
      it("builds a Jira create URL", () => {
        const result = getTicketCreateUrl(mockJiraProvider, "Test description", "Test title");
        expect(result).toBe(
          "https://company.atlassian.net/secure/CreateIssue.jspa/title=Test title^description=Test description"
        );
      });

      it("builds a Zendesk create URL", () => {
        const result = getTicketCreateUrl(mockZendeskProvider, "Test description", "Test title");
        expect(result).toBe(
          "https://company.zendesk.com/agent/filters/new/title=Test title^description=Test description"
        );
      });

      it("emits empty values when no title or description is given", () => {
        const result = getTicketCreateUrl(mockJiraProvider);
        expect(result).toBe("https://company.atlassian.net/secure/CreateIssue.jspa/title=^description=");
      });
    });

    it("returns an empty string when the provider has no ticket_creation_url", () => {
      const provider = withUrl(mockJiraProvider, "");
      expect(getTicketCreateUrl(provider, "d", "t")).toBe("");
    });
  });

  describe("findLinkedTicket", () => {
    it("should find linked ticket for ServiceNow", () => {
      const incident = createMockIncident({
        servicenow_ticket_url: "https://company.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3DINC0012345"
      });
      const result = findLinkedTicket(incident, [mockServiceNowProvider]);
      expect(result).toEqual({
        provider: mockServiceNowProvider,
        ticketUrl: "https://company.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3DINC0012345",
        key: "servicenow_ticket_url"
      });
    });

    it("should return null when no linked ticket found", () => {
      const incident = createMockIncident({});
      const result = findLinkedTicket(incident, [mockServiceNowProvider]);
      expect(result).toBeNull();
    });

    it("should return null when incident has no enrichments", () => {
      const incident = createMockIncident();
      const result = findLinkedTicket(incident, [mockServiceNowProvider]);
      expect(result).toBeNull();
    });
  });

  describe("getTicketEnrichmentKey", () => {
    it("should return correct enrichment key for ServiceNow", () => {
      const result = getTicketEnrichmentKey(mockServiceNowProvider);
      expect(result).toBe("servicenow_ticket_id");
    });

    it("should return correct enrichment key for Jira", () => {
      const result = getTicketEnrichmentKey(mockJiraProvider);
      expect(result).toBe("jira_ticket_id");
    });
  });
}); 