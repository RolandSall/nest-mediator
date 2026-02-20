export interface DiagramNode {
  id: string;
  type: string;
  data: Record<string, any>;
  position: { x: number; y: number };
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface DiagramGraph {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  nodeId: string;
  edgeId?: string;
  message: string;
  severity: Severity;
  rule: string; // which specification produced this
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * A diagram context pre-computed once and shared across all specifications.
 * Avoids each spec rebuilding the same maps/lookups.
 */
export interface DiagramContext {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  nodeMap: Map<string, DiagramNode>;
  /** All outgoing edges from a node, optionally filtered by edge type */
  outgoing: (nodeId: string, edgeType?: string) => DiagramEdge[];
  /** All incoming edges to a node, optionally filtered by edge type */
  incoming: (nodeId: string, edgeType?: string) => DiagramEdge[];
  /** All nodes of a given type */
  nodesOfType: (type: string) => DiagramNode[];
}

export function buildContext(nodes: DiagramNode[], edges: DiagramEdge[]): DiagramContext {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const outgoingCache = new Map<string, DiagramEdge[]>();
  const incomingCache = new Map<string, DiagramEdge[]>();

  for (const e of edges) {
    const out = outgoingCache.get(e.source) ?? [];
    out.push(e);
    outgoingCache.set(e.source, out);

    const inc = incomingCache.get(e.target) ?? [];
    inc.push(e);
    incomingCache.set(e.target, inc);
  }

  const typeCache = new Map<string, DiagramNode[]>();
  for (const n of nodes) {
    const list = typeCache.get(n.type) ?? [];
    list.push(n);
    typeCache.set(n.type, list);
  }

  return {
    nodes,
    edges,
    nodeMap,
    outgoing: (nodeId, edgeType) => {
      const all = outgoingCache.get(nodeId) ?? [];
      return edgeType ? all.filter((e) => e.type === edgeType) : all;
    },
    incoming: (nodeId, edgeType) => {
      const all = incomingCache.get(nodeId) ?? [];
      return edgeType ? all.filter((e) => e.type === edgeType) : all;
    },
    nodesOfType: (type) => typeCache.get(type) ?? [],
  };
}
