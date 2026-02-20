import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, AIProviderConfig } from './types';

interface ChatState {
  // Messages
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  updateLastAssistant: (updater: (content: string) => string) => void;
  clearMessages: () => void;

  // Streaming
  isStreaming: boolean;
  setStreaming: (streaming: boolean) => void;

  // Provider config (persisted)
  providerConfig: AIProviderConfig;
  setProviderConfig: (config: Partial<AIProviderConfig>) => void;

  // UI toggles
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      updateLastAssistant: (updater) =>
        set((s) => {
          const msgs = [...s.messages];
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'assistant') {
              msgs[i] = { ...msgs[i], content: updater(msgs[i].content) };
              break;
            }
          }
          return { messages: msgs };
        }),
      clearMessages: () => set({ messages: [] }),

      isStreaming: false,
      setStreaming: (streaming) => set({ isStreaming: streaming }),

      providerConfig: {
        provider: 'anthropic',
        apiKey: '',
        model: 'claude-sonnet-4-5-20250929',
      },
      setProviderConfig: (config) =>
        set((s) => ({ providerConfig: { ...s.providerConfig, ...config } })),

      chatOpen: false,
      setChatOpen: (open) => set({ chatOpen: open }),
      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),
    }),
    {
      name: 'mediator-flow-chat',
      partialize: (state) => ({
        providerConfig: state.providerConfig,
      }),
    },
  ),
);
