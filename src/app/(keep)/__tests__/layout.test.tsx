import { Children, isValidElement, ReactElement, ReactNode } from "react";
import Navbar from "components/navbar/Navbar";
import { WorkflowModalProvider } from "@/features/workflows/manual-run-workflow";
import { getConfig } from "@/shared/lib/server/getConfig";
import { AssistantPanelHost } from "@/widgets/assistant-panel";
import RootLayout from "../layout";

// The layout is a server component: it is called, and what it returns is
// looked at without rendering any of the app
jest.mock("@/shared/lib/server/getConfig", () => ({ getConfig: jest.fn() }));
jest.mock("@/shared/lib/server/hossted-tenants", () => ({
  isHosstedEnabledForTenant: () => false,
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("next/headers", () => ({ headers: async () => new Map() }));
jest.mock("@/shared/lib/auth/sessionHeader", () => ({
  resolveSessionFromHeader: async () => null,
}));
jest.mock("@hossted/keep-integration/styles.css", () => ({}), {
  virtual: true,
});
jest.mock("../hossted-root", () => ({ HosstedRoot: () => null }));
jest.mock("../../auth-provider", () => ({ NextAuthProvider: () => null }));
jest.mock("../../config-provider", () => ({ ConfigProvider: () => null }));
jest.mock("@/app/sse-provider", () => ({ SSEProvider: () => null }));
jest.mock("components/navbar/Navbar", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/app/(keep)/topology/model/TopologyPollingContext", () => ({
  TopologyPollingContextProvider: () => null,
}));
jest.mock("@/features/workflows/manual-run-workflow", () => ({
  WorkflowModalProvider: () => null,
}));
jest.mock("@/widgets/assistant-panel", () => ({
  AssistantPanelHost: () => null,
}));
jest.mock("@/shared/ui", () => ({
  ThemeScript: () => null,
  WatchUpdateTheme: () => null,
}));

// The body's classes before there was an assistant
const ORIGINAL =
  "h-screen flex flex-col lg:grid lg:grid-cols-[192px_12px_auto] xl:grid-cols-[220px_12px_auto] 2xl:grid-cols-[250px_12px_auto] lg:grid-rows-1 lg:has-[aside[data-minimized='true']]:grid-cols-[0px_12px_auto]";

type Element = ReactElement<{ className?: string; children?: ReactNode }>;

function findAll(node: ReactNode, type: unknown): Element[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) {
      return [];
    }
    return [
      ...(child.type === type ? [child] : []),
      ...findAll(child.props.children, type),
    ];
  });
}

async function getLayout(config: Record<string, unknown>) {
  (getConfig as jest.Mock).mockReturnValue(config);
  const layout = await RootLayout({ children: "page" });
  return {
    bodyClassName: findAll(layout, "body")[0].props.className ?? "",
    shell: Children.toArray(
      findAll(layout, WorkflowModalProvider)[0].props.children
    ) as Element[],
  };
}

it.each([
  ["without the flag", {}],
  ["with the flag off", { KEEP_ASSISTANT_ENABLED: false }],
  [
    "with AI features disabled",
    { KEEP_ASSISTANT_ENABLED: true, KEEP_AI_FEATURES_DISABLED: true },
  ],
])("has the grid it always had %s", async (_, config) => {
  const { bodyClassName } = await getLayout(config);
  expect(bodyClassName).toBe(ORIGINAL);
});

it("has a fourth column in every variant with the flag on", async () => {
  const { bodyClassName } = await getLayout({ KEEP_ASSISTANT_ENABLED: true });
  expect(bodyClassName).toBe(
    ORIGINAL.replaceAll("_auto]", "_minmax(0,1fr)_auto]")
  );
  expect(bodyClassName.match(/_minmax\(0,1fr\)_auto\]/g)).toHaveLength(4);
  expect(bodyClassName).toContain("lg:grid-rows-1");
});

it("has the panel right after the page, as its sibling", async () => {
  const { shell } = await getLayout({ KEEP_ASSISTANT_ENABLED: true });
  expect(shell.map(({ type }) => type)).toEqual([
    Navbar,
    "main",
    AssistantPanelHost,
  ]);
});
