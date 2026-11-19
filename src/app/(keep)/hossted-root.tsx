import { ReactNode } from "react";
import {
  HosstedConfig,
  HosstedConfigProvider,
  HosstedWrapper,
} from "@hossted/keep-integration";

/**
 * Mounts the Hossted provider and wrapper around the app only when the
 * current tenant has Hossted enabled; otherwise renders the children as-is.
 */
export function HosstedRoot({
  enabled,
  config,
  children,
}: {
  enabled: boolean;
  config: HosstedConfig;
  children: ReactNode;
}) {
  if (!enabled) {
    return <>{children}</>;
  }
  return (
    <HosstedConfigProvider config={config}>
      <HosstedWrapper>{children}</HosstedWrapper>
    </HosstedConfigProvider>
  );
}
