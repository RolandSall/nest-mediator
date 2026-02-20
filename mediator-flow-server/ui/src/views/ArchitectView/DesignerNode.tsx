import { Handle, Position, type NodeProps } from '@xyflow/react';
import { getNodeConfig, type DiagramNodeType } from '../../diagram';

export interface DesignerNodeData {
  nodeType: DiagramNodeType;
  name: string;
  subtitle?: string;
  validationStatus?: 'valid' | 'error' | 'warning';
  [key: string]: unknown;
}

export default function DesignerNode({ data, selected }: NodeProps) {
  const nodeType = data.nodeType as DiagramNodeType;
  const config = getNodeConfig(nodeType);
  const name = (data.name as string) || 'Unnamed';
  const subtitle = data.subtitle as string | undefined;
  const status = data.validationStatus as string | undefined;

  const borderStyle =
    status === 'error'
      ? '2px dashed #ef4444'
      : status === 'warning'
        ? '2px dashed #f59e0b'
        : selected
          ? `2px solid ${config.borderColor}`
          : `1px solid ${config.borderColor}`;

  return (
    <div
      style={{
        background: '#1f2937',
        border: borderStyle,
        borderRadius: nodeType === 'behavior' ? 20 : 8,
        minWidth: 160,
        fontSize: 12,
        overflow: 'hidden',
      }}
    >
      <Handle type="target" position={Position.Left} />

      {/* Color header bar */}
      <div
        style={{
          background: config.color,
          color: config.textColor,
          padding: '4px 12px',
          fontWeight: 600,
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{config.label}</span>
        {status === 'error' && <span style={{ color: '#fca5a5' }}>●</span>}
        {status === 'warning' && <span style={{ color: '#fde68a' }}>●</span>}
        {status === 'valid' && <span style={{ color: '#86efac' }}>✓</span>}
      </div>

      {/* Body */}
      <div style={{ padding: '8px 12px', color: '#e5e7eb' }}>
        <div style={{ fontWeight: 500 }}>{name}</div>
        {subtitle && (
          <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
