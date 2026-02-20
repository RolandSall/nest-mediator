import type {
  DiagramNode,
  DiagramEdge,
  ValidationResult,
  ValidationIssue,
} from './types';

export function validateDiagram(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const outgoing = (nodeId: string, edgeType?: string) =>
    edges.filter((e) => e.source === nodeId && (!edgeType || e.type === edgeType));

  const incoming = (nodeId: string, edgeType?: string) =>
    edges.filter((e) => e.target === nodeId && (!edgeType || e.type === edgeType));

  // Duplicate name detection per type
  const namesByType = new Map<string, Map<string, string>>();

  for (const node of nodes) {
    const name = node.data.name;
    if (!name?.trim()) {
      errors.push({ nodeId: node.id, message: `${node.type} node is missing a name` });
      continue;
    }
    const typeMap = namesByType.get(node.type) ?? new Map<string, string>();
    if (typeMap.has(name)) {
      errors.push({
        nodeId: node.id,
        message: `Duplicate ${node.type} name "${name}"`,
      });
    } else {
      typeMap.set(name, node.id);
      namesByType.set(node.type, typeMap);
    }
  }

  for (const node of nodes) {
    switch (node.type) {
      case 'command':
      case 'query': {
        const h = outgoing(node.id, 'handles');
        if (h.length === 0) {
          errors.push({ nodeId: node.id, message: `${node.type} "${node.data.name}" has no handler` });
        } else if (h.length > 1) {
          errors.push({ nodeId: node.id, message: `${node.type} "${node.data.name}" has multiple handlers` });
        }
        break;
      }
      case 'handler': {
        if (incoming(node.id, 'handles').length === 0) {
          errors.push({ nodeId: node.id, message: `Handler "${node.data.name}" has no command/query` });
        }
        if (outgoing(node.id, 'publishes').length === 0) {
          warnings.push({ nodeId: node.id, message: `Handler "${node.data.name}" publishes no events` });
        }
        break;
      }
      case 'event': {
        if (outgoing(node.id, 'consumes').length === 0) {
          warnings.push({ nodeId: node.id, message: `Event "${node.data.name}" has no consumers` });
        }
        if (node.data.isDomainEvent && incoming(node.id, 'applies').length === 0) {
          errors.push({ nodeId: node.id, message: `Domain event "${node.data.name}" has no aggregate` });
        }
        break;
      }
      case 'consumer': {
        if (incoming(node.id, 'consumes').length === 0) {
          errors.push({ nodeId: node.id, message: `Consumer "${node.data.name}" has no event` });
        }
        if (node.data.criticality === 'critical' && outgoing(node.id, 'compensates').length === 0) {
          errors.push({ nodeId: node.id, message: `Critical consumer "${node.data.name}" needs a compensation event` });
        }
        break;
      }
      case 'behavior': {
        if (node.data.targetType) {
          const exists = nodes.some(
            (n) => (n.type === 'command' || n.type === 'query') && n.data.name === node.data.targetType,
          );
          if (!exists) {
            warnings.push({ nodeId: node.id, message: `Behavior targets "${node.data.targetType}" which doesn't exist` });
          }
        }
        break;
      }
      case 'aggregate': {
        if (outgoing(node.id, 'applies').length === 0) {
          errors.push({ nodeId: node.id, message: `Aggregate "${node.data.name}" has no domain events` });
        }
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
