/**
 * @jest-environment node
 */
import { isAssistantEnabled } from "@/shared/lib/assistant-flag";
import { getConfig } from "../getConfig";

const setEnv = (env: Record<string, string | undefined>) => {
  const next: Record<string, string | undefined> = { ...process.env };
  delete next.KEEP_ASSISTANT_ENABLED;
  delete next.KEEP_AI_FEATURES_DISABLED;
  jest.replaceProperty(process, "env", {
    ...next,
    ...env,
  } as NodeJS.ProcessEnv);
};

describe("getConfig KEEP_ASSISTANT_ENABLED", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["production", "true", true],
    ["production", "TRUE", true],
    ["production", "false", false],
    ["production", "1", false],
    ["production", "", false],
    ["production", undefined, false],
    ["development", "true", true],
    ["development", undefined, false],
  ])(
    "NODE_ENV=%s, flag=%s gives %s, without any other setting",
    (NODE_ENV, KEEP_ASSISTANT_ENABLED, expected) => {
      setEnv({ NODE_ENV, KEEP_ASSISTANT_ENABLED });

      expect(getConfig().KEEP_ASSISTANT_ENABLED).toBe(expected);
      expect(isAssistantEnabled(getConfig())).toBe(expected);
    }
  );

  it.each(["true", "TRUE"])(
    "is hidden with KEEP_AI_FEATURES_DISABLED=%s",
    (KEEP_AI_FEATURES_DISABLED) => {
      setEnv({ KEEP_ASSISTANT_ENABLED: "true", KEEP_AI_FEATURES_DISABLED });

      expect(isAssistantEnabled(getConfig())).toBe(false);
    }
  );
});
