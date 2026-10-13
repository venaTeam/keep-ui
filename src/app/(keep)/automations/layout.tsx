import { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getConfig } from "@/shared/lib/server/getConfig";
export default function AutomationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!getConfig().KEEP_AUTOMATIONS_ENABLED) notFound();
  return children;
}
