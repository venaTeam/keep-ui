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
 * Get and construct a URL to create a new ticket in the provider's system
 */
export function getTicketCreateUrl(provider: Provider, description: string = "", title: string = ""): string {
  if (!provider.details?.authentication?.ticket_creation_url) {
    return "";
  }

  let createUrl = provider.details.authentication.ticket_creation_url;

  // TODO: might need to add other providers here
  if (provider.type === "servicenow") {
    const encodedTitle = encodeURIComponent(title);
    const encodedDescription = encodeURIComponent(description);
    const pairs = `short_description=${encodedTitle}^description=${encodedDescription}`;

    // Only a trailing `params/query` segment is the payload marker, and the
    // capture says whether a payload already follows it. A substring test
    // cannot tell those apart, and answering "no payload" with `^` emits a
    // separator with nothing on its left. The payload is one segment, so it
    // stops at `/` -- otherwise a mid-path `params/query` swallows the rest of
    // the path and is mistaken for an existing payload.
    const paramsQuery = createUrl.match(/\/params\/query(?:\/([^/]*))?$/);

    if (paramsQuery) {
      const existingPayload = paramsQuery[1] ?? "";
      createUrl = existingPayload
        ? // Service Operations Workspace URL: extend the existing query
          `${createUrl}^${pairs}`
        : // params/query with nothing after it: start the query
          `${createUrl.replace(/\/$/, "")}/${pairs}`;
    } else {
      // Standard SOW/platform URL: add params/query
      const separator = createUrl.includes("?") ? "&" : "?";
      createUrl = `${createUrl}${separator}params/query=${pairs}`;
    }
  } else {
    const separator = createUrl.includes("?") ? "&" : "?";
    createUrl = `${createUrl}${separator}title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;
  }

  return createUrl;
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