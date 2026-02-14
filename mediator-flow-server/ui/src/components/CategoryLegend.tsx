export interface LegendItem {
  type: string;
  label: string;
  color: string;
  rounded?: boolean;
}

interface Props {
  items: LegendItem[];
  hiddenSet: Set<string>;
  onToggle: (type: string) => void;
  className?: string;
}

export default function CategoryLegend({ items, hiddenSet, onToggle, className = '' }: Props) {
  return (
    <div className={`text-xs flex flex-wrap gap-1 ${className}`}>
      {items.map((item) => {
        const isHidden = hiddenSet.has(item.type);
        return (
          <button
            key={item.type}
            onClick={() => onToggle(item.type)}
            className="flex items-center gap-1 px-2 py-1 rounded transition-colors"
            style={{
              opacity: isHidden ? 0.35 : 1,
              color: isHidden ? '#6b7280' : '#d1d5db',
              background: isHidden ? 'transparent' : 'rgba(255,255,255,0.05)',
            }}
            title={isHidden ? `Show ${item.label}` : `Hide ${item.label}`}
          >
            <span
              className="inline-block w-3 h-3"
              style={{
                background: item.color,
                borderRadius: item.rounded ? '50%' : 3,
              }}
            />
            <span style={{ textDecoration: isHidden ? 'line-through' : 'none' }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
