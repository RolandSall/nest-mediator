import { NodeResizer, Handle, Position, type NodeProps } from '@xyflow/react';

function WarningIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default function ResizableNode({ data }: NodeProps) {
  const isCompensation = data.category === 'compensation';

  return (
    <div
      style={{
        background: data.bg as string,
        color: data.color as string,
        border: isCompensation ? `2px solid #ec4899` : data.border as string,
        borderRadius: ((data.borderRadius as number) ?? 8),
        fontSize: ((data.fontSize as number) ?? 12),
        padding: (data.padding as string) ?? '8px 14px',
        width: '100%',
        height: '100%',
        whiteSpace: (data.whiteSpace as string) ?? 'normal',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: isCompensation ? 6 : 0,
      }}
    >
      <NodeResizer
        color={data.borderColor as string}
        isVisible
        minWidth={(data.minWidth as number) ?? 100}
        minHeight={(data.minHeight as number) ?? 36}
      />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      {isCompensation && <WarningIcon />}
      <span>{data.label as string}</span>
    </div>
  );
}
