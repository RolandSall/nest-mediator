import type { DiagramNode, DiagramEdge, DiagramNodeType, DiagramNodeData } from '../diagram';
import { getEdgeType } from '../diagram';
import { validateDiagram } from '../diagram';
import { layoutGraph } from '../diagram';
import type { ToolCall, DiagramActions } from './types';

let idCounter = 0;
function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${idCounter++}`;
}

/**
 * Executes a batch of tool calls against the diagram state.
 * Maintains a shadow copy so that sequential tool calls within one AI response
 * (e.g. add_node then add_edge referencing the new node) work correctly.
 */
export function createToolExecutor(actions: DiagramActions) {
  // Shadow copies for batch consistency
  let shadowNodes: DiagramNode[] = actions.getNodes();
  let shadowEdges: DiagramEdge[] = actions.getEdges();

  function refreshShadow() {
    shadowNodes = actions.getNodes();
    shadowEdges = actions.getEdges();
  }

  function commitState() {
    actions.setNodes([...shadowNodes]);
    actions.setEdges([...shadowEdges]);
  }

  function calcNextPosition(): { x: number; y: number } {
    if (shadowNodes.length === 0) return { x: 100, y: 100 };
    const maxX = Math.max(...shadowNodes.map((n) => n.position.x));
    const nodesAtMaxX = shadowNodes.filter((n) => n.position.x === maxX);
    const maxY = Math.max(...nodesAtMaxX.map((n) => n.position.y));
    // Stack vertically if there are already nodes at this x, otherwise move right
    if (nodesAtMaxX.length < 4) {
      return { x: maxX, y: maxY + 100 };
    }
    return { x: maxX + 200, y: 100 };
  }

  function executeToolCall(toolCall: ToolCall): string {
    const args = toolCall.arguments;

    switch (toolCall.name) {
      case 'get_diagram': {
        refreshShadow();
        return JSON.stringify({
          nodes: shadowNodes.map((n) => ({ id: n.id, type: n.type, name: n.data.name, data: n.data })),
          edges: shadowEdges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type })),
        });
      }

      case 'add_node': {
        const type = args.type as DiagramNodeType;
        const name = args.name as string;

        const data: DiagramNodeData = { name };

        // Apply type-specific fields
        if (args.fields) data.fields = args.fields as DiagramNodeData['fields'];
        if (args.returnType) data.returnType = args.returnType as string;
        if (args.criticality) data.criticality = args.criticality as DiagramNodeData['criticality'];
        if (args.executionOrder != null) data.executionOrder = args.executionOrder as number;
        if (args.priority != null) data.priority = args.priority as number;
        if (args.scope) data.scope = args.scope as DiagramNodeData['scope'];
        if (args.targetType) data.targetType = args.targetType as string;
        if (args.isDomainEvent != null) data.isDomainEvent = args.isDomainEvent as boolean;
        if (args.aggregateType) data.aggregateType = args.aggregateType as string;
        if (args.aggregateIdField) data.aggregateIdField = args.aggregateIdField as string;
        if (args.idType) data.idType = args.idType as string;
        if (args.stateFields) data.stateFields = args.stateFields as DiagramNodeData['stateFields'];
        if (args.dependencies) data.dependencies = args.dependencies as DiagramNodeData['dependencies'];

        const newNode: DiagramNode = {
          id: nextId('node'),
          type,
          position: calcNextPosition(),
          data,
        };

        shadowNodes = [...shadowNodes, newNode];
        commitState();

        return JSON.stringify({ success: true, nodeId: newNode.id, name: newNode.data.name, type: newNode.type });
      }

      case 'add_edge': {
        const sourceId = args.sourceNodeId as string;
        const targetId = args.targetNodeId as string;

        const sourceNode = shadowNodes.find((n) => n.id === sourceId);
        const targetNode = shadowNodes.find((n) => n.id === targetId);

        if (!sourceNode) return JSON.stringify({ error: `Source node "${sourceId}" not found` });
        if (!targetNode) return JSON.stringify({ error: `Target node "${targetId}" not found` });

        const edgeType = getEdgeType(sourceNode.type, targetNode.type);
        if (!edgeType) {
          return JSON.stringify({
            error: `Invalid connection: ${sourceNode.type} → ${targetNode.type}. Valid connections: command→handler, query→handler, handler→event, event→consumer, consumer→event, aggregate→event`,
          });
        }

        const newEdge: DiagramEdge = {
          id: nextId('edge'),
          source: sourceId,
          target: targetId,
          type: edgeType,
        };

        shadowEdges = [...shadowEdges, newEdge];
        commitState();

        return JSON.stringify({ success: true, edgeId: newEdge.id, type: edgeType });
      }

      case 'update_node': {
        const nodeId = args.nodeId as string;
        const node = shadowNodes.find((n) => n.id === nodeId);
        if (!node) return JSON.stringify({ error: `Node "${nodeId}" not found` });

        const patch: Partial<DiagramNodeData> = {};
        if (args.name !== undefined) patch.name = args.name as string;
        if (args.fields !== undefined) patch.fields = args.fields as DiagramNodeData['fields'];
        if (args.returnType !== undefined) patch.returnType = args.returnType as string;
        if (args.criticality !== undefined) patch.criticality = args.criticality as DiagramNodeData['criticality'];
        if (args.executionOrder !== undefined) patch.executionOrder = args.executionOrder as number;
        if (args.compensationEventId !== undefined) patch.compensationEventId = args.compensationEventId as string;
        if (args.priority !== undefined) patch.priority = args.priority as number;
        if (args.scope !== undefined) patch.scope = args.scope as DiagramNodeData['scope'];
        if (args.targetType !== undefined) patch.targetType = args.targetType as string;
        if (args.isDomainEvent !== undefined) patch.isDomainEvent = args.isDomainEvent as boolean;
        if (args.aggregateType !== undefined) patch.aggregateType = args.aggregateType as string;
        if (args.aggregateIdField !== undefined) patch.aggregateIdField = args.aggregateIdField as string;
        if (args.idType !== undefined) patch.idType = args.idType as string;
        if (args.stateFields !== undefined) patch.stateFields = args.stateFields as DiagramNodeData['stateFields'];
        if (args.dependencies !== undefined) patch.dependencies = args.dependencies as DiagramNodeData['dependencies'];

        shadowNodes = shadowNodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
        );
        commitState();

        return JSON.stringify({ success: true, nodeId });
      }

      case 'remove_node': {
        const nodeId = args.nodeId as string;
        const exists = shadowNodes.some((n) => n.id === nodeId);
        if (!exists) return JSON.stringify({ error: `Node "${nodeId}" not found` });

        shadowNodes = shadowNodes.filter((n) => n.id !== nodeId);
        shadowEdges = shadowEdges.filter((e) => e.source !== nodeId && e.target !== nodeId);
        commitState();

        return JSON.stringify({ success: true, nodeId });
      }

      case 'remove_edge': {
        const edgeId = args.edgeId as string;
        const exists = shadowEdges.some((e) => e.id === edgeId);
        if (!exists) return JSON.stringify({ error: `Edge "${edgeId}" not found` });

        shadowEdges = shadowEdges.filter((e) => e.id !== edgeId);
        commitState();

        return JSON.stringify({ success: true, edgeId });
      }

      case 'find_node': {
        refreshShadow();
        let results = shadowNodes;

        if (args.name) {
          const searchName = (args.name as string).toLowerCase();
          results = results.filter((n) => n.data.name.toLowerCase().includes(searchName));
        }
        if (args.type) {
          results = results.filter((n) => n.type === args.type);
        }

        return JSON.stringify(
          results.map((n) => ({ id: n.id, type: n.type, name: n.data.name })),
        );
      }

      case 'validate_diagram': {
        refreshShadow();
        const result = validateDiagram(shadowNodes, shadowEdges);
        return JSON.stringify(result);
      }

      case 'auto_layout': {
        refreshShadow();
        const direction = (args.direction as 'LR' | 'TB') ?? 'LR';

        // Convert to ReactFlow format for dagre
        const flowNodes = shadowNodes.map((n) => ({
          id: n.id,
          position: n.position,
          data: { width: 180, height: 50 },
        }));
        const flowEdges = shadowEdges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
        }));

        const laid = layoutGraph(flowNodes as any, flowEdges as any, direction);

        shadowNodes = shadowNodes.map((n, i) => ({
          ...n,
          position: laid.nodes[i]?.position ?? n.position,
        }));
        commitState();

        return JSON.stringify({ success: true, direction, nodeCount: shadowNodes.length });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolCall.name}` });
    }
  }

  return { executeToolCall, refreshShadow };
}
