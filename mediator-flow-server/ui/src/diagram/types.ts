// ── Node types on the designer canvas ──

export type DiagramNodeType =
  | 'command'
  | 'query'
  | 'event'
  | 'handler'
  | 'consumer'
  | 'behavior'
  | 'aggregate';

export interface Field {
  name: string;
  type: string;
}

export interface StateField extends Field {
  default?: string;
}

export interface Dependency {
  name: string;
  type: string;
}

export interface DiagramNodeData {
  name: string;
  fields?: Field[];
  returnType?: string;
  // Consumer
  criticality?: 'critical' | 'non-critical';
  executionOrder?: number;
  compensationEventId?: string; // id of an event node on canvas
  // Behavior
  priority?: number;
  scope?: 'command' | 'query' | 'all';
  targetType?: string;
  // Event
  isDomainEvent?: boolean;
  aggregateType?: string;
  aggregateIdField?: string;
  // Aggregate
  idType?: string;
  stateFields?: StateField[];
  // Handler
  dependencies?: Dependency[];
}

export interface DiagramNode {
  id: string;
  type: DiagramNodeType;
  position: { x: number; y: number };
  data: DiagramNodeData;
}

// ── Edge types ──

export type DiagramEdgeType =
  | 'handles'
  | 'publishes'
  | 'consumes'
  | 'compensates'
  | 'applies';

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: DiagramEdgeType;
}

// ── Diagram (persisted) ──

export interface DiagramGraph {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface Diagram {
  id: string;
  name: string;
  description?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface DiagramSummary {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Validation ──

export interface ValidationIssue {
  nodeId: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// ── Code generation ──

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GenerationSummary {
  commands: number;
  queries: number;
  events: number;
  consumers: number;
  behaviors: number;
  aggregates: number;
  totalFiles: number;
}

export interface GenerationResult {
  files: GeneratedFile[];
  tree: string;
  summary: GenerationSummary;
}

// ── Node visual config (palette / designer) ──

export interface NodeTypeConfig {
  type: DiagramNodeType;
  label: string;
  color: string;
  borderColor: string;
  textColor: string;
  description: string;
  group: 'Requests' | 'Flow' | 'Infrastructure';
}

export const NODE_TYPE_CONFIGS: NodeTypeConfig[] = [
  // Requests
  { type: 'command', label: 'Command', color: '#1e40af', borderColor: '#3b82f6', textColor: '#fff', description: 'A request that changes state', group: 'Requests' },
  { type: 'query', label: 'Query', color: '#7e22ce', borderColor: '#a855f7', textColor: '#fff', description: 'A request that reads state', group: 'Requests' },
  // Flow
  { type: 'handler', label: 'Handler', color: '#15803d', borderColor: '#22c55e', textColor: '#fff', description: 'Processes a command or query', group: 'Flow' },
  { type: 'event', label: 'Event', color: '#b45309', borderColor: '#f59e0b', textColor: '#fff', description: 'Something that happened', group: 'Flow' },
  { type: 'consumer', label: 'Consumer', color: '#0f766e', borderColor: '#14b8a6', textColor: '#fff', description: 'Reacts to an event', group: 'Flow' },
  // Infrastructure
  { type: 'behavior', label: 'Behavior', color: '#be185d', borderColor: '#ec4899', textColor: '#fff', description: 'Cross-cutting pipeline concern', group: 'Infrastructure' },
  { type: 'aggregate', label: 'Aggregate', color: '#4338ca', borderColor: '#6366f1', textColor: '#fff', description: 'Event-sourced entity', group: 'Infrastructure' },
];

export function getNodeConfig(type: DiagramNodeType): NodeTypeConfig {
  return NODE_TYPE_CONFIGS.find((c) => c.type === type)!;
}

// ── Edge validation rules ──

/** Which source node types can connect to which target node types, and with what edge type. */
export const VALID_CONNECTIONS: { source: DiagramNodeType; target: DiagramNodeType; edgeType: DiagramEdgeType }[] = [
  { source: 'command', target: 'handler', edgeType: 'handles' },
  { source: 'query', target: 'handler', edgeType: 'handles' },
  { source: 'handler', target: 'event', edgeType: 'publishes' },
  { source: 'event', target: 'consumer', edgeType: 'consumes' },
  { source: 'consumer', target: 'event', edgeType: 'compensates' },
  { source: 'aggregate', target: 'event', edgeType: 'applies' },
];

export function getEdgeType(
  sourceType: DiagramNodeType,
  targetType: DiagramNodeType,
): DiagramEdgeType | null {
  const match = VALID_CONNECTIONS.find(
    (c) => c.source === sourceType && c.target === targetType,
  );
  return match?.edgeType ?? null;
}
