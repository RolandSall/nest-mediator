import { useState } from 'react';
import { useChatStore } from './store';
import type { AIProviderType } from './types';

const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

const OPENAI_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
];

export default function ChatSettingsModal({ onClose }: { onClose: () => void }) {
  const { providerConfig, setProviderConfig } = useChatStore();
  const [provider, setProvider] = useState<AIProviderType>(providerConfig.provider);
  const [apiKey, setApiKey] = useState(providerConfig.apiKey);
  const [model, setModel] = useState(providerConfig.model);

  const models = provider === 'anthropic' ? ANTHROPIC_MODELS : OPENAI_MODELS;

  const handleProviderChange = (p: AIProviderType) => {
    setProvider(p);
    const defaultModel = p === 'anthropic' ? ANTHROPIC_MODELS[0].id : OPENAI_MODELS[0].id;
    setModel(defaultModel);
  };

  const handleSave = () => {
    setProviderConfig({ provider, apiKey, model });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-96 p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-gray-200">AI Settings</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">x</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Provider</label>
            <div className="flex gap-2">
              {(['anthropic', 'openai'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`flex-1 px-3 py-1.5 text-xs rounded border ${
                    provider === p
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {p === 'anthropic' ? 'Claude (Anthropic)' : 'OpenAI'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">API Key</label>
            <input
              type="password"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Stored in localStorage only. {provider === 'anthropic'
                ? 'Sent directly to Anthropic API.'
                : 'Sent per-request through the server proxy (never stored).'}
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Model</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
