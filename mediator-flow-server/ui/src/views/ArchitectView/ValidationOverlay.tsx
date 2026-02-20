import { useState } from 'react';
import type { ValidationResult } from '../../diagram';

interface Props {
  validation: ValidationResult;
  onNavigateToNode: (nodeId: string) => void;
}

export default function ValidationOverlay({ validation, onNavigateToNode }: Props) {
  const [expanded, setExpanded] = useState(false);

  const errorCount = validation.errors.length;
  const warningCount = validation.warnings.length;

  if (errorCount === 0 && warningCount === 0) {
    return (
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-gray-900/90 border border-gray-700 rounded-lg px-4 py-1.5 text-xs text-green-400">
        ✓ No issues
      </div>
    );
  }

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-gray-900/95 border border-gray-700 rounded-lg overflow-hidden" style={{ maxWidth: 500 }}>
      {/* Summary bar */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-1.5 flex items-center gap-3 text-xs hover:bg-gray-800 transition-colors"
      >
        {errorCount > 0 && (
          <span className="text-red-400">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
        )}
        {warningCount > 0 && (
          <span className="text-yellow-400">{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
        )}
        <span className="text-gray-500 ml-auto">{expanded ? '▼' : '▲'}</span>
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="border-t border-gray-700 max-h-48 overflow-y-auto">
          {validation.errors.map((e, i) => (
            <button
              key={`err-${i}`}
              onClick={() => onNavigateToNode(e.nodeId)}
              className="w-full text-left px-4 py-1.5 text-xs text-red-400 hover:bg-gray-800 flex items-center gap-2"
            >
              <span>●</span>
              <span>{e.message}</span>
            </button>
          ))}
          {validation.warnings.map((w, i) => (
            <button
              key={`warn-${i}`}
              onClick={() => onNavigateToNode(w.nodeId)}
              className="w-full text-left px-4 py-1.5 text-xs text-yellow-400 hover:bg-gray-800 flex items-center gap-2"
            >
              <span>●</span>
              <span>{w.message}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
