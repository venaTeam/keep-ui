"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useHotkeys } from "react-hotkeys-hook";
import { useAssistantPanelStore } from "@/entities/assistant";
import { isAssistantEnabled } from "@/shared/lib/assistant-flag";
import { useConfig } from "@/utils/hooks/useConfig";

const AssistantPanel = dynamic(
  () => import("./AssistantPanel").then((mod) => mod.AssistantPanel),
  { ssr: false }
);

function EnabledHost() {
  const isOpen = useAssistantPanelStore((state) => state.isOpen);
  const toggle = useAssistantPanelStore((state) => state.toggle);
  const [wasOpened, setWasOpened] = useState(false);

  useHotkeys("mod+j", toggle, { enableOnFormTags: true, preventDefault: true });

  // Loaded when first opened, and then kept: an answer that is arriving, or a
  // message being written, survives closing the panel
  if (isOpen && !wasOpened) {
    setWasOpened(true);
  }
  return wasOpened ? <AssistantPanel /> : null;
}

/** The place of the assistant panel in the page, and its keyboard shortcut. */
export function AssistantPanelHost() {
  const { data: config } = useConfig();
  return isAssistantEnabled(config) ? <EnabledHost /> : null;
}
