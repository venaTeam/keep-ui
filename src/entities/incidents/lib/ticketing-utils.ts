import { type Provider } from "@/shared/api/providers";
import { type IncidentDto } from "@/entities/incidents/model";

export interface LinkedTicket {
  provider: Provider;
  ticketUrl: string;
  key: string;
}

/**
 * Get the base URL from a provider's authentication details
 */
export function getProviderBaseUrl(provider: Provider): string {
  if (!provider?.details?.authentication) return "";

  const auth = provider.details.authentication;

  return auth.base_url ||
    auth.service_now_base_url ||
    auth.jira_base_url ||
    auth.host ||
    "";
}

/**
 * Get the ticket URL from an incident's enrichments for a specific provider
 */
export function getTicketViewUrl(incident: IncidentDto, provider: Provider): string {
  if (!incident.enrichments) return "";

  const urlKey = `${provider.type}_ticket_url`;
  return incident.enrichments[urlKey] || "";
}

/**
 * Build the ServiceNow deep link that opens a new record form with fields prefilled.
 *
 * ServiceNow does not read prefill values off an arbitrary path segment: they have
 * to ride on the encoded query it looks for.
 *
 * Next Experience (the shape the provider's `ticket_creation_url` hint documents)
 * takes them in a `/params/query/` segment:
 *   .../now/sow/record/incident/-1/params/query/short_description=Foo%5Edescription=Bar
 *
 * Classic UI instances take the same query as a `sysparm_query` parameter:
 *   .../incident.do?sys_id=-1&sysparm_query=short_description=Foo%5Edescription=Bar
 *
 * In both, pairs are separated by a caret encoded as %5E, and each value is
 * URL-encoded so spaces/&/# in an incident name or summary can't truncate the URL.
 */
function buildServiceNowCreateUrl(
  configuredUrl: string,
  title: string,
  description: string
): string {
  const pairs: string[] = [];

  if (title) {
    pairs.push(`short_description=${encodeURIComponent(title)}`);
  }

  if (description) {
    pairs.push(`description=${encodeURIComponent(description)}`);
  }

  // Nothing to prefill — hand back the plain "new record" form.
  if (pairs.length === 0) {
    return configuredUrl;
  }

  const query = pairs.join("%5E");

  // Classic UI: the record form is a *.do page and prefill rides on sysparm_query.
  if (/\.do(\?|$)/.test(configuredUrl)) {
    const separator = configuredUrl.includes("?") ? "&" : "?";
    return `${configuredUrl}${separator}sysparm_query=${query}`;
  }

  // Next Experience: tolerate an admin who already typed the /params or
  // /params/query suffix, so we never emit .../params/params/query/.
  const base = configuredUrl
    .replace(/\/+$/, "")
    .replace(/\/params(\/query)?$/, "");

  return `${base}/params/query/${query}`;
}

/**
 * Get and construct a URL to create a new ticket in the provider's system
 */
export function getTicketCreateUrl(provider: Provider, description: string = "", title: string = ""): string {
  if (!provider.details?.authentication?.ticket_creation_url) {
    return "";
  }

  const createUrl = provider.details.authentication.ticket_creation_url;

  if (provider.type === "servicenow") {
    return buildServiceNowCreateUrl(createUrl, title, description);
  }

  // TODO: Jira and Zendesk ignore these too — they need their own prefill
  // formats (Jira: summary/description query params; Zendesk: its own). Left as
  // it was rather than guessed at, so only ServiceNow behaviour changes here.
  return `${createUrl}/title=${title}^description=${description}`;
}

/**
 * Find the first linked ticket for an incident from any ticketing provider
 */
export function findLinkedTicket(incident: any, ticketingProviders: Provider[]): LinkedTicket | null {
  if (!incident.enrichments) return null;

  // Look for any ticketing provider's ticket URL in enrichments
  for (const provider of ticketingProviders) {
    const ticketKey = `${provider.type}_ticket_url`;
    if (incident.enrichments[ticketKey]) {
      return {
        provider,
        ticketUrl: incident.enrichments[ticketKey],
        key: ticketKey
      };
    }
  }
  return null;
}

export function canCreateTickets(provider: Provider): boolean {
  return provider.tags.includes("ticketing") && Boolean(provider.details?.authentication?.ticket_creation_url);
}

/**
 * Get the enrichment key for a provider's ticket ID
 */
export function getTicketEnrichmentKey(provider: Provider): string {
  return `${provider.type}_ticket_id`;
} 