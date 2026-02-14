import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

export function layoutGraph(
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR',
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 120 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: node.data.width ?? 180, height: node.data.height ?? 50 });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutNodes = nodes.map((node) => {
    const n = g.node(node.id);
    return {
      ...node,
      position: { x: n.x - (n.width / 2), y: n.y - (n.height / 2) },
    };
  });

  return { nodes: layoutNodes, edges };
}
