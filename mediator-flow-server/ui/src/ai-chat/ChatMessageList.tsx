import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ToolCall } from './types';

interface Props {
  messages: ChatMessage[];
  streamingText: string;
}

export default function ChatMessageList({ messages, streamingText }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
      {messages.length === 0 && !streamingText && (
        <div className="text-center text-gray-500 text-xs mt-8 space-y-2">
          <p className="text-lg">AI Chat</p>
          <p>Describe your CQRS flow in natural language.</p>
          <p className="text-gray-600">
            e.g. "Build me an order management system with CreateOrder, CancelOrder commands..."
          </p>
        </div>
      )}

      {messages.map((msg, i) => {
        if (msg.role === 'tool') return null; // Tool results shown under assistant tool calls

        if (msg.role === 'user') {
          return (
            <div key={i} className="flex justify-end">
              <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg px-3 py-2 max-w-[85%]">
                <p className="text-xs text-gray-200 whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          );
        }

        if (msg.role === 'assistant') {
          return (
            <div key={i} className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 max-w-[85%] space-y-2">
                {msg.content && (
                  <p className="text-xs text-gray-300 whitespace-pre-wrap">{msg.content}</p>
                )}
                {msg.toolCalls?.map((tc) => (
                  <ToolCallBubble key={tc.id} toolCall={tc} messages={messages} />
                ))}
              </div>
            </div>
          );
        }

        return null;
      })}

      {streamingText && (
        <div className="flex justify-start">
          <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 max-w-[85%]">
            <p className="text-xs text-gray-300 whitespace-pre-wrap">{streamingText}<span className="animate-pulse">|</span></p>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function ToolCallBubble({ toolCall, messages }: { toolCall: ToolCall; messages: ChatMessage[] }) {
  const [expanded, setExpanded] = useState(false);

  // Find the tool result in messages
  const result = messages.find(
    (m) => m.role === 'tool' && m.toolCallId === toolCall.id,
  );

  const toolLabel = formatToolName(toolCall.name);
  const argsSummary = formatArgs(toolCall.name, toolCall.arguments);

  return (
    <div className="border border-gray-600 rounded px-2 py-1.5 bg-gray-900/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left"
      >
        <span className="text-[10px] text-green-400">
          {toolCall.result !== undefined || result ? '\u2713' : '\u25CF'}
        </span>
        <span className="text-[10px] text-gray-400 font-mono">{toolLabel}</span>
        {argsSummary && (
          <span className="text-[10px] text-gray-500 truncate flex-1">{argsSummary}</span>
        )}
        <span className="text-[10px] text-gray-600">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {expanded && (
        <div className="mt-1.5 space-y-1">
          <div className="text-[10px] text-gray-500 font-mono bg-gray-950 rounded p-1.5 overflow-x-auto">
            <div className="text-gray-400 mb-0.5">Args:</div>
            {JSON.stringify(toolCall.arguments, null, 2)}
          </div>
          {result && result.role === 'tool' && (
            <div className="text-[10px] text-gray-500 font-mono bg-gray-950 rounded p-1.5 overflow-x-auto max-h-32 overflow-y-auto">
              <div className="text-gray-400 mb-0.5">Result:</div>
              {formatResult(result.content)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatToolName(name: string): string {
  return name.replace(/_/g, ' ');
}

function formatArgs(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'add_node':
      return `${args.type} "${args.name}"`;
    case 'add_edge':
      return `${args.sourceNodeId} \u2192 ${args.targetNodeId}`;
    case 'update_node':
      return `${args.nodeId}`;
    case 'remove_node':
      return `${args.nodeId}`;
    case 'remove_edge':
      return `${args.edgeId}`;
    case 'find_node':
      return [args.name && `name="${args.name}"`, args.type && `type=${args.type}`].filter(Boolean).join(' ');
    case 'auto_layout':
      return args.direction as string ?? 'LR';
    default:
      return '';
  }
}

function formatResult(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}
