"use client";

import { useEffect, useState } from "react";
import { Icon, Subtitle } from "@tremor/react";
import { clsx } from "clsx";
import { RiSparkling2Line } from "react-icons/ri";
import { useAssistantPanelStore } from "@/entities/assistant";
import { isAssistantEnabled } from "@/shared/lib/assistant-flag";
import { useConfig } from "@/utils/hooks/useConfig";

/** Opens and closes the assistant panel. For every role. */
export function AssistantToggle() {
  const { data: config } = useConfig();
  const isOpen = useAssistantPanelStore((state) => state.isOpen);
  const toggle = useAssistantPanelStore((state) => state.toggle);
  const [shortcut, setShortcut] = useState("Ctrl+J");

  // In an effect, because the server does not know the platform
  useEffect(() => {
    if (/mac|iphone|ipad/i.test(navigator.platform)) {
      setShortcut("⌘J");
    }
  }, []);

  if (!isAssistantEnabled(config)) {
    return null;
  }
  return (
    <div className="px-2 pt-2">
      <button
        type="button"
        aria-pressed={isOpen}
        aria-keyshortcuts="Meta+J Control+J"
        data-cy="nav-assistant-toggle"
        className={clsx(
          "group flex w-full min-w-0 items-center justify-between rounded-lg px-1 py-0.5 font-medium focus:ring focus:ring-orange-300",
          isOpen ? "bg-stone-200/50" : "hover:bg-stone-200/50"
        )}
        onClick={toggle}
      >
        <span className="flex min-w-0 items-center space-x-1">
          <Icon
            icon={RiSparkling2Line}
            className={clsx(
              "group-hover:text-orange-400",
              isOpen ? "text-orange-400" : "text-black"
            )}
          />
          <Subtitle className="truncate text-xs">Assistant</Subtitle>
        </span>
        <kbd
          aria-hidden="true"
          className="pr-1 font-sans text-xs font-normal text-gray-400"
        >
          {shortcut}
        </kbd>
      </button>
    </div>
  );
}
