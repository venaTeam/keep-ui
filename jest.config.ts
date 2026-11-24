import type { Config } from "jest";
import nextJest from "next/jest.js";
// Trigger workflow

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// react-markdown and what it imports, none of which has a CommonJS build
const MARKDOWN_PACKAGES = [
  "@ungap/structured-clone",
  "bail",
  "ccount",
  "character-entities",
  "character-entities-html4",
  "character-entities-legacy",
  "character-reference-invalid",
  "comma-separated-tokens",
  "decode-named-character-reference",
  "devlop",
  "estree-util-is-identifier-name",
  "hast-util-[a-z-]+",
  "html-url-attributes",
  "is-alphabetical",
  "is-alphanumerical",
  "is-decimal",
  "is-hexadecimal",
  "is-plain-obj",
  "longest-streak",
  "mdast-util-[a-z-]+",
  "micromark[a-z-]*",
  "parse-entities",
  "property-information",
  "react-markdown",
  "remark-[a-z-]+",
  "space-separated-tokens",
  "stringify-entities",
  "trim-lines",
  "trough",
  "unified",
  "unist-util-[a-z-]+",
  "vfile",
  "vfile-message",
  "zwitch",
];

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  // Bare absolute imports (e.g. "utils/hooks/useConfig") resolve under src/.
  // Mirrors tsconfig baseUrl: "src"; keep in sync if baseUrl changes.
  modulePaths: ["<rootDir>/src"],
  moduleNameMapper: {
    // Handle module aliases — keep "/src/" in sync with tsconfig baseUrl: "src"
    "^@/(.*)$": "<rootDir>/src/$1",
    // Force module uuid to resolve with the CJS entry point, because Jest does not support package.json.exports. See https://github.com/uuidjs/uuid/issues/451
    uuid: require.resolve("uuid"),
    "^yaml$": require.resolve("yaml"),
    // Mock monaco-editor modules
    "^monaco-editor$": "<rootDir>/__mocks__/monaco-editor.js",
    "^@monaco-editor/react$": "<rootDir>/__mocks__/@monaco-editor/react.js",
  },
  // Transform ESM packages
  transformIgnorePatterns: [
    "node_modules/(?!(jose|@segment/analytics-node|@copilotkit)/)"
  ],
  // Add more setup options before each test is run
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/e2e/"],
};

// next/jest adds patterns of its own, and a file that any pattern matches is
// not transformed: the packages have to be exempt from every one of them
const exemptMarkdownPackages = (pattern: string) =>
  pattern.replace("(?!(", `(?!(${MARKDOWN_PACKAGES.join("|")}|`);

// Async, because next/jest loads the Next.js config
export default async function getJestConfig(): Promise<Config> {
  const jestConfig = await createJestConfig(config)();
  return {
    ...jestConfig,
    transformIgnorePatterns: jestConfig.transformIgnorePatterns?.map(
      exemptMarkdownPackages
    ),
  };
}
