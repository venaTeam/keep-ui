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
 * The payload can already live in either of two places, and the configured URL
 * decides which: a `params/query` query parameter, or a trailing
 * `/params/query` path segment. Each is extended where it stands; only a URL
 * carrying neither gets the query parameter introduced.
 */
function buildServiceNowCreateUrl(
  configuredUrl: string,
  title: string,
  description: string
): string {
  const pairs = `short_description=${encodeURIComponent(
    title
  )}^description=${encodeURIComponent(description)}`;

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    // Not an absolute URL, so there are no parts to separate; fall back to
    // appending the parameter textually.
    const separator = configuredUrl.includes("?") ? "&" : "?";
    return `${configuredUrl}${separator}params/query=${pairs}`;
  }

  const { origin, pathname, search, hash } = parsed;

  // Query form: `?params/query=<payload>`. The value is extended in place --
  // rebuilding the query through URLSearchParams would re-encode every other
  // parameter and the `^` separators along with it.
  const QUERY_FORM = /([?&]params\/query=)([^&#]*)/;
  if (QUERY_FORM.test(search)) {
    const nextSearch = search.replace(
      QUERY_FORM,
      (_match, prefix: string, payload: string) =>
        payload ? `${prefix}${payload}^${pairs}` : `${prefix}${pairs}`
    );
    return `${origin}${pathname}${nextSearch}${hash}`;
  }

  // Path form: the pathname ends with `/params/query`, optionally already
  // carrying a payload segment. Matching the pathname on its own keeps any
  // `?search` and `#hash` out of the capture instead of swallowing them.
  const pathForm = pathname.match(/\/params\/query(?:\/([^/]*))?$/);
  if (pathForm) {
    const payload = pathForm[1] ?? "";
    const nextPath = payload
      ? // Extend the payload: `^` separates it from the pairs.
        `${pathname}^${pairs}`
      : // Start the payload: there is no earlier pair to separate from.
        `${pathname.replace(/\/$/, "")}/${pairs}`;
    return `${origin}${nextPath}${search}${hash}`;
  }

  // Neither form present: introduce the query parameter.
  const separator = search ? "&" : "?";
  return `${origin}${pathname}${search}${separator}params/query=${pairs}${hash}`;
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

  // TODO: Jira and Zendesk are unchanged here, and both are wrong in the same
  // way ServiceNow was -- the values go on as an unencoded path segment, which
  // neither vendor reads as prefill, so neither prefills today. Fixing them
  // needs each vendor's own contract (Jira takes `summary`, not `title`) and a
  // check against a live instance, so it belongs in its own change rather than
  // riding along with a ServiceNow fix.
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