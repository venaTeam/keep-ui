import { ReactNode } from "react";
import "@hossted/keep-integration/styles.css";
import { HosstedRoot } from "./hossted-root";
import { isHosstedEnabledForTenant } from "@/shared/lib/server/hossted-tenants";
import { NextAuthProvider } from "../auth-provider";

import { ToastContainer } from "react-toastify";
import Navbar from "components/navbar/Navbar";
import { TopologyPollingContextProvider } from "@/app/(keep)/topology/model/TopologyPollingContext";
import { getConfig } from "@/shared/lib/server/getConfig";
import { ConfigProvider } from "../config-provider";

import ReadOnlyBanner from "@/components/banners/read-only-banner";
import { auth } from "@/auth";
import { headers } from "next/headers";
import {
  SESSION_HEADER,
  resolveSessionFromHeader,
} from "@/shared/lib/auth/sessionHeader";
import { ThemeScript, WatchUpdateTheme } from "@/shared/ui";
import "@/app/globals.css";
import "react-toastify/dist/ReactToastify.css";
import { WorkflowModalProvider } from "@/features/workflows/manual-run-workflow";
import ScreenWakeLock from "@/components/ui/ScreenWakeLock";
import { SSEProvider } from "@/app/sse-provider";
import { FontSizeInitializer } from "@/components/FontSizeInitializer";
import ActiveUsersTracker from "@/components/ActiveUsersTracker";
import { AssistantPanelHost } from "@/widgets/assistant-panel";
import { isAssistantEnabled } from "@/shared/lib/assistant-flag";
import { getShellClassName } from "./shell-class-name";

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const config = getConfig();
  const session = await resolveSessionFromHeader(
    (await headers()).get(SESSION_HEADER),
    auth
  );
  const hosstedEnabled = isHosstedEnabledForTenant(session?.tenantId);
  const hosstedConfig = {
    proxyUrl: config.HOSSTED_PROXY_URL,
    apiToken: config.HOSSTED_API_TOKEN,
    dashboardUrl: config.HOSSTED_DASHBOARD_URL,
    toastDisabled: config.HOSSTED_TOAST_DISABLED,
  };

  return (
    <html lang="en" className="bg-gray-50">
      <body className={getShellClassName(isAssistantEnabled(config))}>
        {/* ThemeScript must be the first thing to avoid flickering */}
        <ThemeScript />
        <FontSizeInitializer />
        <ConfigProvider config={{ ...config, HOSSTED_ENABLED: hosstedEnabled }}>
          <HosstedRoot enabled={hosstedEnabled} config={hosstedConfig}>
            <ScreenWakeLock />
            <NextAuthProvider session={session}>
              <SSEProvider>
                <TopologyPollingContextProvider>
                  <WorkflowModalProvider>
                    <Navbar />
                    {/* https://discord.com/channels/752553802359505017/1068089513253019688/1117731746922893333 */}
                    <main
                      className="page-container flex flex-col col-start-3 overflow-auto"
                      data-cy="nav-page-main"
                    >
                      {/* Add the banner here, before the navbar */}
                      {config.READ_ONLY && <ReadOnlyBanner />}
                      <div className="flex-1">
                        <ActiveUsersTracker />
                        {children}
                      </div>
                      {/** footer */}
                      {process.env.GIT_COMMIT_HASH &&
                        process.env.SHOW_BUILD_INFO !== "false" && (
                          <div className="pointer-events-none opacity-80 w-full p-2 text-slate-400 text-xs">
                            <div className="w-full text-right">
                              Version: {process.env.KEEP_VERSION} | Build:{" "}
                              {process.env.GIT_COMMIT_HASH.slice(0, 6)}
                            </div>
                          </div>
                        )}
                      <ToastContainer />
                    </main>
                    <AssistantPanelHost />
                  </WorkflowModalProvider>
                </TopologyPollingContextProvider>
              </SSEProvider>
            </NextAuthProvider>
          </HosstedRoot>
        </ConfigProvider>
        <WatchUpdateTheme />
      </body>
    </html>
  );
}
