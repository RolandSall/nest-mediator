import { type DragEvent } from 'react';
import { NODE_TYPE_CONFIGS, type DiagramNodeType } from '../../diagram';

const groups = ['Requests', 'Flow', 'Infrastructure'] as const;

export default function Palette() {
  const onDragStart = (e: DragEvent, nodeType: DiagramNodeType) => {
    e.dataTransfer.setData('application/designer-node-type', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-48 bg-gray-900 border-r border-gray-800 p-3 overflow-y-auto flex-shrink-0">
      <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
        Palette
      </h3>
      {groups.map((group) => {
        const items = NODE_TYPE_CONFIGS.filter((c) => c.group === group);
        return (
          <div key={group} className="mb-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">
              {group}
            </div>
            {items.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                className="flex items-center gap-2 px-2 py-1.5 mb-1 rounded cursor-grab hover:bg-gray-800 transition-colors"
              >
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ background: item.color }}
                />
                <div>
                  <div className="text-xs text-gray-300 font-medium">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-gray-500 leading-tight">
                    {item.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
