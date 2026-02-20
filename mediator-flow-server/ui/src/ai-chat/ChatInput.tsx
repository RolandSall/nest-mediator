import { useState, useRef, useEffect } from 'react';

interface Props {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
}

export default function ChatInput({ onSend, onStop, isStreaming, disabled }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isStreaming) textareaRef.current?.focus();
  }, [isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setText('');
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, [text]);

  return (
    <div className="border-t border-gray-800 p-3">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500 resize-none"
          placeholder={disabled ? 'Configure API key in settings...' : 'Describe your CQRS flow...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isStreaming}
          rows={1}
          style={{ maxHeight: 120 }}
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-500 shrink-0"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() || disabled}
            className="px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 shrink-0"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
