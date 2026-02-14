import { type ReactNode, forwardRef } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const DetailPanel = forwardRef<HTMLDivElement, Props>(({ title, onClose, children }, ref) => (
  <div
    ref={ref}
    className="absolute top-0 right-0 w-80 h-full bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto z-20"
  >
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-sm font-bold text-gray-300">{title}</h3>
      <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
        x
      </button>
    </div>
    {children}
  </div>
));

DetailPanel.displayName = 'DetailPanel';

export default DetailPanel;
