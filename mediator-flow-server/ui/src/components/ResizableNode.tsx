import { NodeResizer, Handle, Position, type NodeProps } from '@xyflow/react';

export default function ResizableNode({ data }: NodeProps) {
  return (
    <div
      style={{
        background: data.bg as string,
        color: data.color as string,
        border: data.border as string,
        borderRadius: ((data.borderRadius as number) ?? 8),
        fontSize: ((data.fontSize as number) ?? 12),
        padding: (data.padding as string) ?? '8px 14px',
        width: '100%',
        height: '100%',
        whiteSpace: (data.whiteSpace as string) ?? 'normal',
        overflow: 'hidden',
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
      {data.label as string}
    </div>
  );
}
