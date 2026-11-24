import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ASSISTANT_PANEL_STORAGE_KEY } from "@/shared/lib/assistant-storage";

interface PersistedPanelState {
  isOpen: boolean;
  /** Keyed by tenant id only: no personal data goes to local storage. */
  conversationIdByTenant: Record<string, string>;
}

interface AssistantPanelState extends PersistedPanelState {
  toggle: () => void;
  close: () => void;
  setConversationId: (tenantId: string, conversationId: string) => void;
  /** Forgets the tenant's conversation, unless it moved on to another one. */
  clearConversationId: (tenantId: string, conversationId?: string) => void;
}

// Local storage is the user's to edit, and may hold an older shape
function sanitize(persisted: unknown): PersistedPanelState {
  const { isOpen, conversationIdByTenant } = (persisted ??
    {}) as Partial<PersistedPanelState>;
  return {
    isOpen: isOpen === true,
    conversationIdByTenant: Object.fromEntries(
      Object.entries(conversationIdByTenant ?? {}).filter(
        ([, id]) => typeof id === "string" && id !== ""
      )
    ),
  };
}

/**
 * Whether the panel is open, and which conversation it shows. The only
 * assistant state that outlives the page: messages never go to storage.
 */
export const useAssistantPanelStore = create<AssistantPanelState>()(
  persist(
    (set) => ({
      isOpen: false,
      conversationIdByTenant: {},
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      close: () => set({ isOpen: false }),
      setConversationId: (tenantId, conversationId) =>
        set((state) => ({
          conversationIdByTenant: {
            ...state.conversationIdByTenant,
            [tenantId]: conversationId,
          },
        })),
      clearConversationId: (tenantId, conversationId) =>
        set((state) => {
          const current = state.conversationIdByTenant[tenantId];
          if (
            current === undefined ||
            (conversationId !== undefined && conversationId !== current)
          ) {
            return state;
          }
          const { [tenantId]: _, ...others } = state.conversationIdByTenant;
          return { conversationIdByTenant: others };
        }),
    }),
    {
      name: ASSISTANT_PANEL_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({
        isOpen,
        conversationIdByTenant,
      }): PersistedPanelState => ({
        isOpen,
        conversationIdByTenant,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    }
  )
);
