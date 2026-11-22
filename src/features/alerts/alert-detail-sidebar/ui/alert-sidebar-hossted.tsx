import { HosstedSidebarSection } from "@hossted/keep-integration";
import { AlertDto } from "@/entities/alerts/model";
import { FieldHeader } from "@/shared/ui";
import { useConfig } from "@/utils/hooks/useConfig";

/**
 * The alert sidebar's Hossted section, rendered only when Hossted is enabled
 * for the current tenant.
 */
export function AlertSidebarHossted({ alert }: { alert: AlertDto }) {
  const { data: config } = useConfig();
  if (config?.HOSSTED_ENABLED !== true) {
    return null;
  }
  return (
    <div>
      <FieldHeader>Hossted</FieldHeader>
      <HosstedSidebarSection
        request={{
          fingerprint: alert.fingerprint,
          payload: alert,
        }}
      />
    </div>
  );
}
