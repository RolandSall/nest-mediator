import type { DiagramNode, DiagramEdge } from '../diagram';

// ── Chat messages ──

export interface ChatMessageUser {
  role: 'user';
  content: string;
}

export interface ChatMessageAssistant {
  role: 'assistant';
  content: string;
  toolCalls?: ToolCall[];
}

export interface ChatMessageToolResult {
  role: 'tool';
  toolCallId: string;
  toolName: string;
  content: string;
}

export type ChatMessage = ChatMessageUser | ChatMessageAssistant | ChatMessageToolResult;

// ── Tool calls ──

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}

// ── Provider config ──

export type AIProviderType = 'anthropic' | 'openai';

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  model: string;
}

// ── Provider client interface ──

export interface AIProviderClient {
  sendMessage(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
    callbacks: StreamCallbacks,
  ): Promise<ChatMessageAssistant>;
  abort(): void;
}

// ── Streaming callbacks ──

export interface StreamCallbacks {
  onText: (text: string) => void;
  onToolCall: (toolCall: ToolCall) => void;
}

// ── Tool definitions (JSON Schema format) ──

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ── Diagram actions exposed to the AI tool executor ──

export interface DiagramActions {
  getNodes: () => DiagramNode[];
  getEdges: () => DiagramEdge[];
  setNodes: (updater: DiagramNode[] | ((prev: DiagramNode[]) => DiagramNode[])) => void;
  setEdges: (updater: DiagramEdge[] | ((prev: DiagramEdge[]) => DiagramEdge[])) => void;
}
