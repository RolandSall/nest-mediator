import Anthropic from '@anthropic-ai/sdk';
import type { AIProviderClient, ChatMessage, ToolDefinition, StreamCallbacks, ToolCall } from './types';

export function createAnthropicProvider(apiKey: string, model: string): AIProviderClient {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let abortController: AbortController | null = null;

  return {
    async sendMessage(
      messages: ChatMessage[],
      tools: ToolDefinition[],
      systemPrompt: string,
      callbacks: StreamCallbacks,
    ) {
      abortController = new AbortController();

      // Convert messages to Anthropic format
      const anthropicMessages: Anthropic.MessageParam[] = [];
      for (const msg of messages) {
        if (msg.role === 'user') {
          anthropicMessages.push({ role: 'user', content: msg.content });
        } else if (msg.role === 'assistant') {
          const content: Anthropic.ContentBlockParam[] = [];
          if (msg.content) {
            content.push({ type: 'text', text: msg.content });
          }
          if (msg.toolCalls) {
            for (const tc of msg.toolCalls) {
              content.push({
                type: 'tool_use',
                id: tc.id,
                name: tc.name,
                input: tc.arguments,
              });
            }
          }
          if (content.length > 0) {
            anthropicMessages.push({ role: 'assistant', content });
          }
        } else if (msg.role === 'tool') {
          // Tool results must be in a user message for Anthropic
          const lastMsg = anthropicMessages[anthropicMessages.length - 1];
          const toolResultBlock: Anthropic.ToolResultBlockParam = {
            type: 'tool_result',
            tool_use_id: msg.toolCallId,
            content: msg.content,
          };
          if (lastMsg?.role === 'user' && Array.isArray(lastMsg.content)) {
            (lastMsg.content as Anthropic.ContentBlockParam[]).push(toolResultBlock);
          } else {
            anthropicMessages.push({ role: 'user', content: [toolResultBlock] });
          }
        }
      }

      // Convert tools to Anthropic format
      const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      }));

      let textContent = '';
      const toolCalls: ToolCall[] = [];
      let currentToolCall: Partial<ToolCall> | null = null;
      let inputJsonBuf = '';

      const stream = client.messages.stream(
        {
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: anthropicMessages,
          tools: anthropicTools,
        },
        { signal: abortController.signal },
      );

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolCall = {
              id: event.content_block.id,
              name: event.content_block.name,
              arguments: {},
            };
            inputJsonBuf = '';
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            textContent += event.delta.text;
            callbacks.onText(event.delta.text);
          } else if (event.delta.type === 'input_json_delta' && currentToolCall) {
            inputJsonBuf += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolCall) {
            try {
              currentToolCall.arguments = inputJsonBuf ? JSON.parse(inputJsonBuf) : {};
            } catch {
              currentToolCall.arguments = {};
            }
            const tc = currentToolCall as ToolCall;
            toolCalls.push(tc);
            callbacks.onToolCall(tc);
            currentToolCall = null;
            inputJsonBuf = '';
          }
        }
      }

      return {
        role: 'assistant' as const,
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    },

    abort() {
      abortController?.abort();
      abortController = null;
    },
  };
}
