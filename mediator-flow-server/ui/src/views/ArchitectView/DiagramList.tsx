import { useDiagrams, useDeleteDiagram } from '../../diagram';

interface Props {
  onLoad: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

export default function DiagramList({ onLoad, onNew, onClose }: Props) {
  const { data: diagrams, isLoading } = useDiagrams();
  const deleteMutation = useDeleteDiagram();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-[500px] max-h-[70vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-gray-200">Saved Diagrams</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">x</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-6 text-gray-500 text-sm">Loading...</div>
          )}

          {diagrams && diagrams.length === 0 && (
            <div className="p-6 text-gray-500 text-sm">No saved diagrams yet.</div>
          )}

          {diagrams?.map((d) => (
            <div
              key={d.id}
              className="flex items-center px-6 py-3 border-b border-gray-800 hover:bg-gray-800/50"
            >
              <button
                onClick={() => { onLoad(d.id); onClose(); }}
                className="flex-1 text-left"
              >
                <div className="text-sm font-medium text-gray-300">{d.name}</div>
                {d.description && (
                  <div className="text-xs text-gray-500 mt-0.5">{d.description}</div>
                )}
                <div className="text-[10px] text-gray-600 mt-1">
                  {d.nodeCount} nodes · Updated {new Date(d.updatedAt).toLocaleDateString()}
                </div>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete "${d.name}"?`)) {
                    deleteMutation.mutate(d.id);
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300 ml-3 px-2 py-1"
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={() => { onNew(); onClose(); }}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            New Diagram
          </button>
        </div>
      </div>
    </div>
  );
}
