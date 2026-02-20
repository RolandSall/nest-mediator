import type { AIProviderConfig, AIProviderClient } from './types';
import { createAnthropicProvider } from './provider-anthropic';
import { createOpenAIProvider } from './provider-openai';

export function createProvider(config: AIProviderConfig): AIProviderClient {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicProvider(config.apiKey, config.model);
    case 'openai':
      return createOpenAIProvider(config.apiKey, config.model);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
