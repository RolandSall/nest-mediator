import type { AIProviderClient, ChatMessage, ToolDefinition, StreamCallbacks, ToolCall } from './types';

export function createOpenAIProvider(apiKey: string, model: string): AIProviderClient {
  let abortController: AbortController | null = null;

  return {
    async sendMessage(
      messages: ChatMessage[],
      tools: ToolDefinition[],
      systemPrompt: string,
      callbacks: StreamCallbacks,
    ) {
      abortController = new AbortController();

      // Convert messages to OpenAI format
      const openaiMessages: any[] = [{ role: 'system', content: systemPrompt }];

      for (const msg of messages) {
        if (msg.role === 'user') {
          openaiMessages.push({ role: 'user', content: msg.content });
        } else if (msg.role === 'assistant') {
          const assistantMsg: any = { role: 'assistant', content: msg.content || null };
          if (msg.toolCalls?.length) {
            assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            }));
          }
          openaiMessages.push(assistantMsg);
        } else if (msg.role === 'tool') {
          openaiMessages.push({
            role: 'tool',
            tool_call_id: msg.toolCallId,
            content: msg.content,
          });
        }
      }

      // Convert tools to OpenAI format
      const openaiTools = tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));

      // Call the backend proxy which forwards to OpenAI
      const res = await fetch('/api/ai/openai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          model,
          messages: openaiMessages,
          tools: openaiTools,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI proxy error: ${res.status} ${errorText}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let textContent = '';
      const toolCalls: ToolCall[] = [];
      const toolCallBuffers: Map<number, { id: string; name: string; args: string }> = new Map();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              textContent += delta.content;
              callbacks.onText(delta.content);
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallBuffers.has(idx)) {
                  toolCallBuffers.set(idx, {
                    id: tc.id ?? '',
                    name: tc.function?.name ?? '',
                    args: '',
                  });
                }
                const buf = toolCallBuffers.get(idx)!;
                if (tc.id) buf.id = tc.id;
                if (tc.function?.name) buf.name = tc.function.name;
                if (tc.function?.arguments) buf.args += tc.function.arguments;
              }
            }
          } catch {
            // Skip unparseable SSE chunks
          }
        }
      }

      // Finalize tool calls
      for (const [, buf] of toolCallBuffers) {
        let args: Record<string, unknown> = {};
        try {
          args = buf.args ? JSON.parse(buf.args) : {};
        } catch {
          // skip
        }
        const tc: ToolCall = { id: buf.id, name: buf.name, arguments: args };
        toolCalls.push(tc);
        callbacks.onToolCall(tc);
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
