// server only!
/**
 * Base URL of keep-assistant, or undefined when it is not configured. The
 * localhost default exists for local development only: in production a missing
 * `ASSISTANT_API_URL` turns the feature off instead of pointing at localhost.
 */
export function getAssistantApiUrl(): string | undefined {
  if (process.env.ASSISTANT_API_URL) {
    return process.env.ASSISTANT_API_URL;
  }
  return process.env.NODE_ENV === "production"
    ? undefined
    : "http://localhost:8086";
}
