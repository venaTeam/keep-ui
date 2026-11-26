import { InternalConfig } from "@/types/internal-config";

/** Whether the assistant is part of the app: its own flag, and AI in general. */
export function isAssistantEnabled(
  config:
    | Partial<
        Pick<
          InternalConfig,
          "KEEP_ASSISTANT_ENABLED" | "KEEP_AI_FEATURES_DISABLED"
        >
      >
    | null
    | undefined
): boolean {
  return !!config?.KEEP_ASSISTANT_ENABLED && !config.KEEP_AI_FEATURES_DISABLED;
}
