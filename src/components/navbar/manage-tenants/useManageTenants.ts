import useSWR, { SWRConfiguration } from "swr";
import { useApi } from "@/shared/lib/hooks/useApi";

// Mirrors the gateway DTOs (VENA-5596): src/models/tenant.py, src/models/operator.py
export type TenantOut = { id: string; name: string };
export type OperatorOut = {
  id: string;
  name: string;
  group: string;
  tenant_id: string;
  apikey: string;
};
export type SubjectType = "user" | "group";
export type Role = "admin" | "editor" | "viewer";
export type RoleAssignment = {
  subject: string;
  subject_type: SubjectType;
  role: Role;
};

const DEFAULT: SWRConfiguration = { revalidateOnFocus: false };

// Minimum characters before the async user/group pickers query Keycloak.
// Each search is capped server-side (max 20), so this is just to avoid firing
// on a single character.
export const SEARCH_MIN_CHARS = 2;

// Shared react-select styles for the pickers: a slightly smaller font, and the
// menu portalled above the modal.
export const asyncSelectStyles = {
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
  control: (base: any) => ({ ...base, fontSize: "0.8rem", minHeight: 34 }),
  menu: (base: any) => ({ ...base, fontSize: "0.8rem" }),
  option: (base: any) => ({ ...base, fontSize: "0.8rem" }),
  placeholder: (base: any) => ({ ...base, fontSize: "0.8rem" }),
  singleValue: (base: any) => ({ ...base, fontSize: "0.8rem" }),
  input: (base: any) => ({ ...base, fontSize: "0.8rem" }),
};

/** Tenants the caller can see (superadmin -> all; others -> their tenants). */
export function useTenants(options: SWRConfiguration = DEFAULT) {
  const api = useApi();
  return useSWR<TenantOut[]>(
    api.isReady() ? "/tenants" : null,
    (url) => api.get(url),
    options
  );
}

/** The caller's Keycloak groups that do not yet have an operator. */
export function useAvailableGroups(options: SWRConfiguration = DEFAULT) {
  const api = useApi();
  return useSWR<string[]>(
    api.isReady() ? "/operators/available-groups" : null,
    (url) => api.get(url),
    options
  );
}

/** Operators for a tenant. No request until a tenant is selected. */
export function useOperators(
  tenantId?: string,
  options: SWRConfiguration = DEFAULT
) {
  const api = useApi();
  const key =
    api.isReady() && tenantId
      ? `/operators?tenant_id=${encodeURIComponent(tenantId)}`
      : null;
  return useSWR<OperatorOut[]>(key, (url) => api.get(url), options);
}

// --- Keycloak directory (via the existing /auth/* routes) -----------------

export type KeycloakUser = { email: string; username?: string; name: string };
export type KeycloakGroup = { id: string; name: string; path?: string };

export type WhoAmI = { tenant_id: string; role?: string };

/**
 * The backend-resolved identity (tenant_id + role). Unlike the Keycloak token
 * claim, `role` here reflects the env-based `superadmin` allowlist, so the UI
 * gates buttons on it.
 */
export function useWhoami(options: SWRConfiguration = DEFAULT) {
  const api = useApi();
  return useSWR<WhoAmI>(
    api.isReady() ? "/whoami" : null,
    (url) => api.get(url),
    options
  );
}

/** All Keycloak users (SWR-deduped, shared across every SubjectSelect). */
export function useKeycloakUsers(options: SWRConfiguration = DEFAULT) {
  const api = useApi();
  return useSWR<KeycloakUser[]>(
    api.isReady() ? "/auth/users" : null,
    (url) => api.get(url),
    options
  );
}

/** All Keycloak groups (includes the full `path` used as the grant subject). */
export function useKeycloakGroups(options: SWRConfiguration = DEFAULT) {
  const api = useApi();
  return useSWR<KeycloakGroup[]>(
    api.isReady() ? "/auth/groups" : null,
    (url) => api.get(url),
    options
  );
}

export type TenantDetail = {
  id: string;
  name: string;
  roles: RoleAssignment[];
  operators: { id: string; name: string; group: string }[];
};

/** One tenant with its role grants + operators. No request until an id is given. */
export function useTenant(
  tenantId?: string,
  options: SWRConfiguration = DEFAULT
) {
  const api = useApi();
  const key = api.isReady() && tenantId ? `/tenants/${tenantId}` : null;
  return useSWR<TenantDetail>(key, (url) => api.get(url), options);
}
