/**
 * @jest-environment node
 */
import { getConfig } from "../getConfig";

const setEnv = (env: Record<string, string | undefined>) => {
  const next: Record<string, string | undefined> = { ...process.env };
  delete next.KEEP_ASSISTANT_ENABLED;
  delete next.ASSISTANT_API_URL;
  jest.replaceProperty(process, "env", {
    ...next,
    ...env,
  } as NodeJS.ProcessEnv);
};

describe("getConfig KEEP_ASSISTANT_ENABLED", () => {
  const url = "http://assistant.internal:8080";

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["production", "true", url, true],
    ["production", "TRUE", url, true],
    ["production", "true", undefined, false],
    ["production", "true", "", false],
    ["production", "false", url, false],
    ["production", "1", url, false],
    ["production", undefined, url, false],
    ["development", "true", url, true],
    ["development", "true", undefined, true],
    ["development", undefined, undefined, false],
  ])(
    "NODE_ENV=%s, flag=%s, url=%s gives %s",
    (NODE_ENV, KEEP_ASSISTANT_ENABLED, ASSISTANT_API_URL, expected) => {
      setEnv({ NODE_ENV, KEEP_ASSISTANT_ENABLED, ASSISTANT_API_URL });

      expect(getConfig().KEEP_ASSISTANT_ENABLED).toBe(expected);
    }
  );

  it("never puts the service URL in the config sent to the browser", () => {
    setEnv({ KEEP_ASSISTANT_ENABLED: "true", ASSISTANT_API_URL: url });

    expect(JSON.stringify(getConfig())).not.toContain(url);
  });
});
