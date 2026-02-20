import { useCallback, useRef, useState } from 'react';
import { useChatStore } from './store';
import { createProvider } from './provider-factory';
import { createToolExecutor } from './tool-executor';
import { TOOL_DEFINITIONS, SYSTEM_PROMPT } from './tools';
import type { ChatMessage, ChatMessageAssistant, ChatMessageToolResult, DiagramActions, AIProviderClient } from './types';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import ChatSettingsModal from './ChatSettingsModal';

const MAX_TOOL_ITERATIONS = 10;

interface Props {
  diagramActions: DiagramActions;
  onClose: () => void;
}

export default function ChatDrawer({ diagramActions, onClose }: Props) {
  const {
    messages,
    addMessage,
    clearMessages,
    isStreaming,
    setStreaming,
    providerConfig,
    settingsOpen,
    setSettingsOpen,
  } = useChatStore();

  const [streamingText, setStreamingText] = useState('');
  const providerRef = useRef<AIProviderClient | null>(null);

  const hasApiKey = !!providerConfig.apiKey.trim();

  const handleSend = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', content: text };
    addMessage(userMsg);

    if (!hasApiKey) {
      addMessage({ role: 'assistant', content: 'Please configure your API key in settings (gear icon above).' });
      return;
    }

    setStreaming(true);
    setStreamingText('');

    const provider = createProvider(providerConfig);
    providerRef.current = provider;

    const executor = createToolExecutor(diagramActions);

    // Build conversation history
    let conversationMessages: ChatMessage[] = [...useChatStore.getState().messages];

    try {
      let iterations = 0;

      while (iterations < MAX_TOOL_ITERATIONS) {
        iterations++;
        let currentText = '';

        const assistantResponse: ChatMessageAssistant = await provider.sendMessage(
          conversationMessages,
          TOOL_DEFINITIONS,
          SYSTEM_PROMPT,
          {
            onText: (chunk) => {
              currentText += chunk;
              setStreamingText(currentText);
            },
            onToolCall: () => {
              // Tool calls will be processed after the full response
            },
          },
        );

        setStreamingText('');

        // Add assistant message to store and conversation
        addMessage(assistantResponse);
        conversationMessages = [...conversationMessages, assistantResponse];

        // If no tool calls, we're done
        if (!assistantResponse.toolCalls?.length) {
          break;
        }

        // Execute tool calls and feed results back
        executor.refreshShadow();
        for (const tc of assistantResponse.toolCalls) {
          const result = executor.executeToolCall(tc);
          tc.result = result;

          const toolResultMsg: ChatMessageToolResult = {
            role: 'tool',
            toolCallId: tc.id,
            toolName: tc.name,
            content: result,
          };

          addMessage(toolResultMsg);
          conversationMessages = [...conversationMessages, toolResultMsg];
        }

        // Continue the loop — the AI might want to make more tool calls
        // or produce a final text response
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addMessage({ role: 'assistant', content: '(Stopped by user)' });
      } else {
        addMessage({ role: 'assistant', content: `Error: ${err.message}` });
      }
    } finally {
      setStreaming(false);
      setStreamingText('');
      providerRef.current = null;
    }
  }, [addMessage, diagramActions, hasApiKey, providerConfig, setStreaming]);

  const handleStop = useCallback(() => {
    providerRef.current?.abort();
  }, []);

  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-gray-900 border-l border-gray-800 flex flex-col z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <h3 className="text-xs font-bold text-gray-300">AI Chat</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 border border-gray-700 rounded"
            title="Clear chat"
          >
            Clear
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-gray-500 hover:text-gray-300 px-1.5 py-0.5 border border-gray-700 rounded text-[10px]"
            title="Settings"
          >
            Settings
          </button>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 ml-1"
            title="Close"
          >
            x
          </button>
        </div>
      </div>

      {/* No API key banner */}
      {!hasApiKey && (
        <div className="mx-3 mt-2 px-3 py-2 bg-amber-900/30 border border-amber-700/50 rounded text-[10px] text-amber-300">
          No API key configured.{' '}
          <button
            onClick={() => setSettingsOpen(true)}
            className="underline hover:text-amber-200"
          >
            Open settings
          </button>{' '}
          to get started.
        </div>
      )}

      {/* Messages */}
      <ChatMessageList messages={messages} streamingText={streamingText} />

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={isStreaming}
        disabled={!hasApiKey}
      />

      {/* Settings modal */}
      {settingsOpen && <ChatSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
