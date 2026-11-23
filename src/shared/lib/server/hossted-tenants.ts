/**
 * Whether the Hossted integration is enabled for a tenant, per the
 * comma-separated tenant IDs in HOSSTED_ENABLED_TENANTS (read on every call;
 * unset or empty means disabled for every tenant).
 */
export function isHosstedEnabledForTenant(
  tenantId: string | null | undefined
): boolean {
  if (!tenantId) {
    return false;
  }
  const enabledTenants = (process.env.HOSSTED_ENABLED_TENANTS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return enabledTenants.includes(tenantId);
}
