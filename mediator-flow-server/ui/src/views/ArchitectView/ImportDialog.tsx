import { useState } from 'react';
import { useImportTopology } from '../../diagram';
import type { DiagramGraph } from '../../diagram';

interface Props {
  onImport: (graph: DiagramGraph) => void;
  onClose: () => void;
}

export default function ImportDialog({ onImport, onClose }: Props) {
  const importMutation = useImportTopology();
  const [service, setService] = useState('');

  const handleImport = () => {
    importMutation.mutate(service || undefined, {
      onSuccess: (graph) => {
        onImport(graph);
        onClose();
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-96 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-gray-200">Import Topology</h2>
          <p className="text-xs text-gray-500 mt-1">
            Load your running application's topology into the designer canvas.
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Service filter (optional)</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 outline-none focus:border-blue-500"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="All services"
            />
          </div>

          {importMutation.isError && (
            <div className="text-xs text-red-400">
              Failed to import topology. Is the server running?
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importMutation.isPending}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
          >
            {importMutation.isPending ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
