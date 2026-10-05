"use client";

import { useSession } from "next-auth/react";
import { Search } from "@/components/navbar/Search";
import { NoiseReductionLinks } from "@/components/navbar/NoiseReductionLinks";
import { AlertsLinks } from "@/components/navbar/AlertsLinks";
import { UserInfo } from "@/components/navbar/UserInfo";
import { Menu } from "@/components/navbar/Menu";
import { MinimizeMenuButton } from "@/components/navbar/MinimizeMenuButton";
import { DashboardLinks } from "@/components/navbar/DashboardLinks";
import { IncidentsLinks } from "@/components/navbar/IncidentLinks";
import { SetSentryUser } from "./SetSentryUser";
// @ts-ignore: CSS import type declarations are handled by the bundler
import "./Navbar.css";

export default function NavbarInner() {
  const { data: session } = useSession();

  return (
    <>
      <Menu session={session}>
        <Search session={session} />
        <div
          className="pt-4 space-y-4 flex-1 overflow-auto scrollable-menu-shadow"
          data-cy="nav-sections"
        >
          <DashboardLinks />
          <AlertsLinks session={session} />
          <NoiseReductionLinks session={session} />
          <IncidentsLinks session={session} />
        </div>
        <UserInfo session={session} />
      </Menu>
      <MinimizeMenuButton />
      <SetSentryUser session={session} />
    </>
  );
}
